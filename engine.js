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
                
                this.data.push({
                    dt: dt, // CRUCIAL pour le calcul de durée
                    user,
                    hour: dt.getHours(),
                    day: dt.getDay(), 
                    words: msg.split(' ').length,
                    shouts: (msg.match(/!/g) || []).length,
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
        const totalWords = udf.reduce((a, b) => a + b.words, 0);
        return {
            total: totalMsgs,
            avgWords: totalMsgs > 0 ? Math.round(totalWords / totalMsgs) : 0,
            shouts: udf.reduce((a, b) => a + b.shouts, 0),
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
        })).reverse(); // Inverser pour avoir Lundi en haut
    }

    getRanking(crit) {
        const stats = this.users.map(u => {
            const s = this.getUserStats(u);
            let score = s.total;
            if(crit === "Variety") score = s.avgWords;
            if(crit === "Shouts") score = s.shouts;
            return { user: u, score };
        });
        return stats.sort((a,b) => b.score - a.score).slice(0, 5);
    }
}