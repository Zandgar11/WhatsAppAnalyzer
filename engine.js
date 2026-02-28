class RetroEngine {
    constructor() {
        this.chatData = [];
        this.users = [];
        this.daysOrder = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
    }

    loadFile(file, progressCallback, completeCallback) {
        const reader = new FileReader();
        
        reader.onprogress = (e) => {
            if (e.lengthComputable) {
                const progress = (e.loaded / e.total) * 90;
                progressCallback(progress);
            }
        };

        reader.onload = (e) => {
            const text = e.target.result;
            this.parseChat(text);
            progressCallback(100);
            completeCallback();
        };

        reader.readAsText(file);
    }

    parseChat(text) {
        const lines = text.split('\n');
        // Regex pour le format : dd/mm/yyyy, hh:mm - Auteur: Message
        const regex = /^(\d{1,2}\/\d{1,2}\/\d{4}),\s(\d{1,2}:\d{2})\s-\s(.*?):\s(.*)/;
        
        this.chatData = [];
        let previousDt = null;

        lines.forEach(line => {
            const m = line.match(regex);
            if (m) {
                const [_, dateStr, timeStr, user, msg] = m;
                try {
                    const dParts = dateStr.split('/');
                    const tParts = timeStr.split(':');
                    const dt = new Date(dParts[2], dParts[1]-1, dParts[0], tParts[0], tParts[1]);
                    
                    if(isNaN(dt.getTime())) return;

                    let delta = 0;
                    if(previousDt) {
                        delta = (dt - previousDt) / 1000;
                    }

                    // Détection simplifiée des médias
                    const isMedia = msg.includes("<Médias omis>") || msg.includes("IMG-");
                    
                    // On compte les "!"
                    const shouts = (msg.match(/!/g) || []).length;

                    this.chatData.push({
                        dt, user, msg,
                        len: msg.length,
                        words: msg.trim().split(/\s+/).length,
                        hour: dt.getHours(),
                        day: dt.toLocaleDateString('en-US', { weekday: 'long' }),
                        day_code: dt.getDay() === 0 ? 6 : dt.getDay() - 1,
                        is_media: isMedia,
                        is_night: dt.getHours() < 6 || dt.getHours() > 23,
                        shouts: shouts,
                        delta: delta
                    });
                    previousDt = dt;
                } catch(e) { console.error("Erreur ligne:", line); }
            }
        });

        // Calcul des nouvelles sessions (pause > 6h)
        this.chatData.forEach((d, i) => {
            d.new_session = (i === 0 || d.delta > 21600);
        });

        this.users = [...new Set(this.chatData.map(d => d.user))].sort();
    }

    count() { return this.chatData.length; }

    getGlobalStats() {
        if(this.chatData.length === 0) return { total:0, media:0, timespan:0 };
        const d1 = this.chatData[0].dt;
        const d2 = this.chatData[this.chatData.length-1].dt;
        const diff = (d2 - d1) / (1000 * 3600 * 24);
        
        return {
            total: this.chatData.length,
            media: this.chatData.filter(d => d.is_media).length,
            timespan: Math.round(diff * 10) / 10
        };
    }

    getMsgsPerUser() {
        const counts = {};
        this.chatData.forEach(d => counts[d.user] = (counts[d.user] || 0) + 1);
        return counts;
    }

    getUserStats(user) {
        const udf = this.chatData.filter(d => d.user === user);
        if(udf.length === 0) return { total:0, words:0, avgLen:0, nightOwl:0, shouts:0 };

        const totalWords = udf.reduce((a, b) => a + b.words, 0);
        const totalLen = udf.reduce((a, b) => a + b.len, 0);

        return {
            total: udf.length,
            words: totalWords,
            avgLen: Math.round((totalLen / udf.length) * 10) / 10,
            nightOwl: udf.filter(d => d.is_night).length,
            shouts: udf.reduce((a, b) => a + b.shouts, 0),
            starters: udf.filter(d => d.new_session).length
        };
    }

    getHeatmapData() {
        const matrix = this.daysOrder.map(day => ({ day, hours: Array(24).fill(0) }));

        this.chatData.forEach(d => {
            if(d.day_code >= 0 && d.day_code < 7) {
                matrix[d.day_code].hours[d.hour]++;
            }
        });

        const flatten = [];
        matrix.forEach(row => {
            row.hours.forEach((count, hour) => {
                flatten.push({ day: row.day, hour, count });
            });
        });
        return flatten;
    }

    getVocabularyRichness() {
        return this.users.map(user => {
            const udf = this.chatData.filter(d => d.user === user);
            const allWords = udf.map(d => d.msg.toLowerCase()).join(" ").split(/\s+/).filter(w => w.length > 2);
            const uniqueWords = new Set(allWords);
            const ratio = allWords.length > 0 ? (uniqueWords.size / allWords.length) * 100 : 0;
            return { 
                user, 
                variety: Math.round((allWords.length / udf.length) * 10) / 10, 
                uniqueRatio: Math.round(ratio * 10) / 10 
            };
        });
    }

    getSpamMetrics() {
        return this.users.map(user => {
            const udf = this.chatData.filter(d => d.user === user);
            const spamCount = udf.filter(d => d.delta > 0 && d.delta < 10).length;
            const ratio = (spamCount / udf.length) * 100;
            return { user, spam: `${spamCount} rafales (${Math.round(ratio)}%)`, score: ratio };
        });
    }

    getPodiumRanking(criterion) {
        let stats = [];
        if(criterion === "Messages") {
            const counts = this.getMsgsPerUser();
            stats = Object.entries(counts).map(([user, count]) => ({ user, score: count }));
        } else if(criterion === "Variety") {
            stats = this.getVocabularyRichness().map(v => ({ user: v.user, score: v.variety }));
        } else if(criterion === "Spam-O-Meter") {
            stats = this.getSpamMetrics().map(s => ({ user: s.user, score: s.score }));
        } else {
            stats = this.users.map(user => ({ user, score: this.getUserStats(user).shouts }));
        }

        return stats.sort((a,b) => b.score - a.score).slice(0, 3);
    }
}