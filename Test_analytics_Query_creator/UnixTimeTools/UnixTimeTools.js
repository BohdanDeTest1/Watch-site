// Unix Time Tools module
// Exposes: window.Tools.unixTimeTools.init(containerEl), onActivate()

(function () {
    window.Tools = window.Tools || {};

    let rootEl = null;
    let nowInterval = null;

    let relativeTargetMs = null;
    let relativeTimer = null;

    function pad2(n) { return String(n).padStart(2, '0'); }

    function parseUnixToMs(raw) {
        const s = String(raw ?? '').trim().replace(/\s+/g, '');
        if (!s) return { ok: false, error: 'Empty value' };
        if (!/^\-?\d+$/.test(s)) return { ok: false, error: 'Only integer numbers are supported' };

        const isNeg = s.startsWith('-');
        const digits = isNeg ? s.slice(1) : s;

        const n = Number(s);
        if (!Number.isFinite(n)) return { ok: false, error: 'Number is too large' };

        let ms;
        // seconds/ms/us/ns by length
        if (digits.length <= 10) ms = n * 1000;
        else if (digits.length <= 13) ms = n;
        else if (digits.length <= 16) ms = n / 1000;
        else if (digits.length <= 19) ms = n / 1_000_000;
        else return { ok: false, error: 'Unsupported timestamp length' };

        return { ok: true, ms };
    }

    function formatUTC(date) {
        const fmt = new Intl.DateTimeFormat('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false,
            timeZone: 'UTC'
        });
        return fmt.format(date) + ' (UTC)';
    }

    function formatLocal(date) {
        const fmt = new Intl.DateTimeFormat('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
            hour12: false
        });

        const offsetMin = -date.getTimezoneOffset();
        const sign = offsetMin >= 0 ? '+' : '-';
        const abs = Math.abs(offsetMin);
        const hh = pad2(Math.floor(abs / 60));
        const mm = pad2(abs % 60);

        return `${fmt.format(date)} (GMT${sign}${hh}:${mm})`;
    }

    function formatRelative(targetMs, nowMs) {
        let diff = Math.round((targetMs - nowMs) / 1000);
        const isFuture = diff > 0;
        diff = Math.abs(diff);

        const YEAR = 365 * 24 * 3600;
        const DAY = 24 * 3600;
        const HOUR = 3600;
        const MIN = 60;

        const parts = [];

        const years = Math.floor(diff / YEAR); diff -= years * YEAR;
        const days = Math.floor(diff / DAY); diff -= days * DAY;
        const hours = Math.floor(diff / HOUR); diff -= hours * HOUR;
        const mins = Math.floor(diff / MIN); diff -= mins * MIN;
        const secs = diff;

        if (years) parts.push(`${years} year${years === 1 ? '' : 's'}`);
        if (days) parts.push(`${days} day${days === 1 ? '' : 's'}`);
        if (hours) parts.push(`${hours} hour${hours === 1 ? '' : 's'}`);
        if (mins) parts.push(`${mins} minute${mins === 1 ? '' : 's'}`);
        parts.push(`${secs} second${secs === 1 ? '' : 's'}`);

        const text = parts.join(' ');
        return isFuture ? `in ${text}` : `${text} ago`;
    }

    function unitFactorMs(unit) {
        switch (unit) {
            case 'ms': return 1;
            case 'sec': return 1000;
            case 'min': return 60_000;
            case 'hour': return 3_600_000;
            case 'day': return 86_400_000;
            case 'year': return 31_536_000_000; // 365 days
            default: return 1;
        }
    }

    function $(sel) { return rootEl.querySelector(sel); }

    function setText(id, text) {
        const el = $(`#${id}`);
        if (el) el.textContent = text;
    }

    function showError(id, msg) {
        const el = $(`#${id}`);
        if (!el) return;
        el.textContent = msg || '';
        el.classList.toggle('show', Boolean(msg));
    }

    function copyText(text) {
        const s = String(text ?? '');
        if (!s) return;
        navigator.clipboard?.writeText(s).catch(() => { });
    }

    function startNowTicker() {
        if (nowInterval) clearInterval(nowInterval);

        const tick = () => {
            const sec = Math.floor(Date.now() / 1000);
            setText('uttNowEpoch', String(sec));
        };

        tick();
        nowInterval = setInterval(tick, 1000);
    }

    function wireEvents() {
        $('#uttNowCopy').addEventListener('click', () => {
            copyText($('#uttNowEpoch')?.textContent);
        });

        $('#uttUnixConvert').addEventListener('click', () => {
            showError('uttUnixErr', '');

            const raw = $('#uttUnixInput').value;
            const parsed = parseUnixToMs(raw);

            if (!parsed.ok) {
                setText('uttUtcOut', '—');
                setText('uttLocalOut', '—');
                setText('uttRelOut', '—');

                relativeTargetMs = null;
                if (relativeTimer) { clearInterval(relativeTimer); relativeTimer = null; }

                showError('uttUnixErr', parsed.error);
                return;
            }

            const d = new Date(parsed.ms);
            setText('uttUtcOut', formatUTC(d));
            setText('uttLocalOut', formatLocal(d));

            relativeTargetMs = parsed.ms;

            const tick = () => {
                if (relativeTargetMs == null) return;
                setText('uttRelOut', formatRelative(relativeTargetMs, Date.now()));
            };

            tick();
            if (relativeTimer) clearInterval(relativeTimer);
            relativeTimer = setInterval(tick, 1000);
        });

        $('#uttHumanConvert').addEventListener('click', () => {
            const y = Number($('#uttY').value);
            const m = Number($('#uttM').value);
            const d = Number($('#uttD').value);
            const hh = Number($('#uttH').value);
            const mm = Number($('#uttMin').value);
            const ss = Number($('#uttS').value);

            const utcMs = Date.UTC(y, m, d, hh, mm, ss);
            const unixSec = Math.floor(utcMs / 1000);
            setText('uttHumanOut', String(unixSec));
        });

        $('#uttHumanCopy').addEventListener('click', () => {
            copyText($('#uttHumanOut')?.textContent);
        });

        $('#uttUnitConvert').addEventListener('click', () => {
            showError('uttUnitErr', '');

            const valRaw = $('#uttUnitVal').value;
            const from = $('#uttUnitFrom').value;
            const to = $('#uttUnitTo').value;

            const val = Number(valRaw);
            if (!Number.isFinite(val)) {
                setText('uttUnitOut', '—');
                showError('uttUnitErr', 'Please enter a valid number');
                return;
            }

            const res = (val * unitFactorMs(from)) / unitFactorMs(to);
            const out = Number.isInteger(res) ? String(res) : String(Math.round(res * 1e9) / 1e9);
            setText('uttUnitOut', out);
        });

        $('#uttUnitCopy').addEventListener('click', () => {
            copyText($('#uttUnitOut')?.textContent);
        });

        $('#uttDiffCalc').addEventListener('click', () => {
            showError('uttDiffErr', '');

            const aRaw = $('#uttDiffA').value;
            const bRaw = $('#uttDiffB').value;
            const unit = $('#uttDiffUnit').value;

            const a = parseUnixToMs(aRaw);
            const b = parseUnixToMs(bRaw);

            if (!a.ok || !b.ok) {
                setText('uttDiffOut', '—');
                showError('uttDiffErr',
                    (!a.ok ? `1st: ${a.error}` : '') + (!b.ok ? `  2nd: ${b.error}` : '')
                );
                return;
            }

            const diffMs = a.ms - b.ms;
            const res = diffMs / unitFactorMs(unit);
            const out = Number.isInteger(res) ? String(res) : String(Math.round(res * 1e9) / 1e9);
            setText('uttDiffOut', out);
        });

        $('#uttDiffCopy').addEventListener('click', () => {
            copyText($('#uttDiffOut')?.textContent);
        });
    }

    async function mount(container) {
        if (rootEl) return;

        const html = await fetch('UnixTimeTools/UnixTimeTools.html').then(r => r.text());

        rootEl = document.createElement('div');
        rootEl.id = 'tab4View';
        rootEl.className = 'utt-view hidden';
        rootEl.innerHTML = html;

        container.appendChild(rootEl);

        wireEvents();
        startNowTicker();
    }

    window.Tools.unixTimeTools = {
        async init(container) {
            await mount(container);
        },
        onActivate() {
            // refresh current epoch immediately
            if (!rootEl) return;
            setText('uttNowEpoch', String(Math.floor(Date.now() / 1000)));
        }
    };
})();
