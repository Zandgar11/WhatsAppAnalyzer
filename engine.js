class RetroEngine {
    constructor() {
        this.data = [];
        this.users = [];
    }

    loadFile(file, callback) {
        const reader = new FileReader();
        reader.onload = (e) => {
            this.parse(e.target.result);
            callback();
        };
        reader.readAsText(file);
    }

    parse(text) {
        const lines = text.split('\n');
        const regex = /^(\d{1,2}\/\d{1,2}\/\d{4}),\s(\d{1,2}:\d{2})\s-\s(.*?):\s(.*)/;
        
        this.data = [];
        lines.forEach(line => {
            const m = line.match(regex);
            if (m) {
                const [_, dateStr, timeStr, user, msg] = m;
                const d = dateStr.split('/');
                const t = timeStr.split(':');
                const dt = new Date(d[2], d[1]-1, d[0], t[0], t[1]);
                
                // Détection MAJUSCULES (plus de 2 lettres et pas de minuscules)
                const isCaps = msg.length > 2 && msg === msg.toUpperCase() && /[A-Z]/.test(msg);

                this.data.push({
                    dt, user, msg,
                    hour: dt.getHours(),
                    day: dt.getDay(), 
                    words: msg.split(/\s+/).length,
                    shouts: (msg.match(/!/g) || []).length,
                    isCaps: isCaps,
                    isMedia: msg.includes("<Médias omis>"),
                    isNight: dt.getHours() < 6
                });
            }
        });
        this.users = [...new Set(this.data.map(d => d.user))];
    }

    getGlobalStats() {
        if (this.data.length < 2) return { total: 0, media: 0, timespan: 0 };
        const first = this.data[0].dt;
        const last = this.data[this.data.length - 1].dt;
        const diffDays = Math.ceil(Math.abs(last - first) / (1000 * 60 * 60 * 24));
        
        return {
            total: this.data.length,
            media: this.data.filter(d => d.isMedia).length,
            timespan: diffDays || 1
        };
    }

    getMsgsPerUser() {
        const res = {};
        this.data.forEach(d => res[d.user] = (res[d.user] || 0) + 1);
        return res;
    }

    getUserStats(user) {
        const udf = this.data.filter(d => d.user === user);
        const totalMsgs = udf.length;
        
        // Calcul des messages répétés (doublons)
        const counts = {};
        udf.forEach(m => {
            if(!m.isMedia && m.msg.trim().length > 1) {
                counts[m.msg] = (counts[m.msg] || 0) + 1;
            }
        });
        const repeats = Object.entries(counts)
            .filter(([_, count]) => count > 1)
            .sort((a, b) => b[1] - a[1]);

        return {
            total: totalMsgs,
            avgWords: totalMsgs > 0 ? Math.round(udf.reduce((a,b) => a + b.words, 0) / totalMsgs) : 0,
            shouts: udf.reduce((a, b) => a + b.shouts, 0),
            caps: udf.filter(d => d.isCaps).length,
            repeats: repeats,
            nightOwl: udf.filter(d => d.isNight).length
        };
    }

    getHeatmapData() {
        const days = ["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"];
        return days.map((name, dayIdx) => ({
            name,
            data: Array.from({length: 24}, (_, hour) => ({
                x: hour + 'h',
                y: this.data.filter(d => d.day === dayIdx && d.hour === hour).length
            }))
        })).reverse();
    }

    getRanking(crit) {
        const stats = this.users.map(u => {
            const s = this.getUserStats(u);
            let score = s.total;
            if(crit === "Variety") score = s.avgWords;
            if(crit === "Shouts") score = s.shouts;
            if(crit === "Caps") score = s.caps;
            return { user: u, score };
        });
        return stats.sort((a,b) => b.score - a.score).slice(0, 5);
    }
}