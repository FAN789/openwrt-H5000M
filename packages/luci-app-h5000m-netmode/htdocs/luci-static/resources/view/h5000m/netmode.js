'use strict';
'require view';
'require fs';
'require ui';
'require poll';

return view.extend({
	handleSave: null,
	handleSaveApply: null,
	handleReset: null,

	statusCommand: function() {
		return fs.exec('/usr/sbin/h5000m-netmode', [ 'status' ]).catch(function() {
			return { stdout: '' };
		});
	},

	load: function() {
		return this.statusCommand();
	},

	parseStatus: function(res) {
		var data = {};

		(res.stdout || '').trim().split(/\n/).forEach(function(line) {
			var pos = line.indexOf('=');
			if (pos > -1)
				data[line.substring(0, pos)] = line.substring(pos + 1);
		});

		return data;
	},

	styleNode: function() {
		return E('style', {}, [
			'.h5net{--net-blue:#4f8ff7;--net-green:#31b985;--net-amber:#e7a33e;--net-red:#e45f5f}',
			'.h5net-head{display:flex;justify-content:space-between;align-items:center;gap:18px;padding:2px 2px 14px;margin-bottom:14px;border-bottom:1px solid var(--border-color-low,#e8e8e8)}',
			'.h5net-head h2{margin:0 0 4px;font-size:22px;line-height:1.3}.h5net-head p{margin:0;color:var(--text-color-medium,#666);font-size:13px}',
			'.h5net-active{display:inline-flex;align-items:center;gap:7px;padding:6px 10px;border-radius:999px;background:rgba(49,185,133,.11);color:var(--net-green);font-size:12px;font-weight:600;white-space:nowrap}',
			'.h5net-active:before{content:"";width:7px;height:7px;border-radius:50%;background:currentColor}.h5net-active.warn{color:var(--net-amber);background:rgba(231,163,62,.11)}.h5net-active.fail{color:var(--net-red);background:rgba(228,95,95,.11)}',
			'.h5net-note{margin:0 0 14px;padding:10px 12px;border-left:3px solid var(--net-blue);border-radius:4px;background:rgba(79,143,247,.07);color:var(--text-color-medium,#555);font-size:13px}',
			'.h5net-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}',
			'.h5net-card{position:relative;padding:15px;border:1px solid var(--border-color-medium,#ddd);border-radius:11px;background:var(--background-color-high,#fff);cursor:pointer;user-select:none;transition:border-color .18s,box-shadow .18s,transform .18s}',
			'.h5net-card:hover{border-color:rgba(79,143,247,.6);transform:translateY(-1px)}.h5net-card:focus{outline:2px solid rgba(79,143,247,.35);outline-offset:2px}',
			'.h5net-card.selected{border-color:rgba(79,143,247,.72);box-shadow:0 0 0 2px rgba(79,143,247,.08)}.h5net-card.active{border-color:rgba(49,185,133,.65);box-shadow:0 0 0 2px rgba(49,185,133,.08)}.h5net-card.unselected{opacity:.62}',
			'.h5net-cardtop{display:flex;align-items:flex-start;justify-content:space-between;gap:10px}.h5net-name{display:flex;align-items:center;gap:10px}',
			'.h5net-icon{display:flex;align-items:center;justify-content:center;width:38px;height:38px;border-radius:10px;background:rgba(79,143,247,.10);color:var(--net-blue);font-size:12px;font-weight:700}.h5net-card.modem .h5net-icon{background:rgba(49,185,133,.10);color:var(--net-green)}',
			'.h5net-name h3{margin:0 0 2px;font-size:16px}.h5net-role{color:var(--text-color-medium,#777);font-size:12px}.h5net-card.selected .h5net-role{color:var(--net-blue);font-weight:600}',
			'.h5net-state{display:inline-flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:var(--net-red);white-space:nowrap}.h5net-state:before{content:"";width:7px;height:7px;border-radius:50%;background:currentColor}.h5net-state.up{color:var(--net-green)}.h5net-state.idle{color:var(--text-color-medium,#888)}',
			'.h5net-protos{display:flex;flex-wrap:wrap;gap:7px;margin-top:15px}.h5net-proto{padding:5px 8px;border-radius:7px;background:var(--background-color-low,#f5f5f5);font-size:12px;color:var(--text-color-medium,#666)}.h5net-proto.current{background:rgba(49,185,133,.11);color:var(--net-green);font-weight:600}',
			'.h5net-actions{display:flex;justify-content:flex-end;align-items:center;margin-top:14px;padding-top:14px;border-top:1px solid var(--border-color-low,#e8e8e8)}.h5net-actions .cbi-button{min-width:112px}',
			'@media(max-width:620px){.h5net-head{display:block}.h5net-active{margin-top:11px}.h5net-grid{grid-template-columns:1fr}.h5net-actions .cbi-button{width:100%}}'
		].join(''));
	},

	exitLabel: function(exit) {
		if (exit === 'wan') return _('Wired WAN');
		if (exit === 'modem') return _('5G modem');
		if (exit === 'other') return _('Other route');
		return _('No available exit');
	},

	modeOrder: function(mode) {
		if (mode === 'modem_first') return [ 'modem', 'wan' ];
		if (mode === 'wan_only') return [ 'wan' ];
		if (mode === 'modem_only') return [ 'modem' ];
		return [ 'wan', 'modem' ];
	},

	orderMode: function(order) {
		if (order.length === 1) return order[0] === 'modem' ? 'modem_only' : 'wan_only';
		return order[0] === 'modem' ? 'modem_first' : 'wan_first';
	},

	roleLabel: function(mode, kind) {
		var order = this.modeOrder(mode);
		var position = order.indexOf(kind);
		if (position < 0) return _('Not selected');
		if (order.length === 1) return _('Only exit');
		return position === 0 ? '1 · ' + _('Preferred exit') : '2 · ' + _('Fallback exit');
	},

	connectionState: function(present, up) {
		if (present !== '1') return { label: _('Not configured'), cls: 'idle' };
		if (up === '1') return { label: _('Connected'), cls: 'up' };
		return { label: _('Disconnected'), cls: '' };
	},

	selectRoute: function(kind, ev) {
		var order;
		if (ev) ev.preventDefault();
		if (this.applying) return;

		order = this.modeOrder(this.pendingMode);
		if (!this.selecting)
			order = [ kind ];
		else if (order.length === 1 && order[0] !== kind)
			order.push(kind);
		else if (order.length > 1)
			order = [ kind ];

		this.selecting = true;
		this.pendingMode = this.orderMode(order);
		this.repaint();
	},

	cardKeydown: function(kind, ev) {
		if (ev.key === 'Enter' || ev.key === ' ') this.selectRoute(kind, ev);
	},

	routeCard: function(kind, data) {
		var modem = kind === 'modem';
		var present = modem ? data.modem_present : data.wan_present;
		var up4 = modem ? data.modem_up : data.wan_up;
		var up6 = modem ? data.modem6_up : data.wan6_up;
		var ready4 = modem ? (data.modem4_ready || up4) : (data.wan4_ready || up4);
		var ready6 = modem ? (data.modem6_ready || up6) : (data.wan6_ready || up6);
		var order = this.modeOrder(this.pendingMode);
		var selected = order.indexOf(kind) > -1;
		var active4 = data.active4 === kind;
		var active6 = data.active6 === kind;
		var state = this.connectionState(present, (up4 === '1' || up6 === '1') ? '1' : '0');
		var cls = 'h5net-card ' + (modem ? 'modem' : 'wan') + (selected ? ' selected' : ' unselected') + ((active4 || active6) ? ' active' : '');

		return E('div', {
			'class': cls,
			'role': 'button',
			'tabindex': '0',
			'aria-pressed': selected ? 'true' : 'false',
			'click': L.bind(this.selectRoute, this, kind),
			'keydown': L.bind(this.cardKeydown, this, kind)
		}, [
			E('div', { 'class': 'h5net-cardtop' }, [
				E('div', { 'class': 'h5net-name' }, [
					E('div', { 'class': 'h5net-icon' }, modem ? '5G' : 'WAN'),
					E('div', {}, [
						E('h3', {}, modem ? _('5G modem') : _('Wired WAN')),
						E('div', { 'class': 'h5net-role' }, this.roleLabel(this.pendingMode, kind))
					])
				]),
				E('div', { 'class': 'h5net-state ' + state.cls }, state.label)
			]),
			E('div', { 'class': 'h5net-protos' }, [
				E('span', { 'class': 'h5net-proto' + (active4 ? ' current' : '') }, active4 ? _('IPv4 in use') : (ready4 === '1' ? _('IPv4 ready') : _('IPv4 unavailable'))),
				E('span', { 'class': 'h5net-proto' + (active6 ? ' current' : '') }, active6 ? _('IPv6 in use') : (ready6 === '1' ? _('IPv6 ready') : _('IPv6 unavailable')))
			])
		]);
	},

	statusMessage: function(data) {
		var mode = data.mode;
		var preferred = mode === 'modem_first' || mode === 'modem_only' ? 'modem' : 'wan';
		var fallback = preferred === 'wan' ? 'modem' : 'wan';
		var active = data.active4 !== 'none' ? data.active4 : data.active6;

		if (active === 'none') return _('No default route is currently available. Check the cable or 5G connection.');
		if (mode === 'wan_only' || mode === 'modem_only')
			return _('Only %s is enabled by the current policy.').format(this.exitLabel(preferred));
		if (active === fallback)
			return _('%s is unavailable, so traffic has switched to %s.').format(this.exitLabel(preferred), this.exitLabel(fallback));
		if (active === preferred)
			return _('Traffic is using the preferred exit. The fallback will take over when needed.');
		return _('Traffic is currently using another default route.');
	},

	applySelection: function() {
		if (this.applying || this.pendingMode === this.liveData.mode) return;
		this.applying = true;
		this.repaint();

		return fs.exec('/usr/sbin/h5000m-netmode', [ 'set', this.pendingMode ]).then(L.bind(function() {
			ui.addNotification(null, E('p', _('Exit selection applied successfully.')));
			this.selecting = false;
			return new Promise(L.bind(function(resolve) {
				window.setTimeout(L.bind(function() {
					this.applying = false;
					this.refreshStatus().then(resolve);
				}, this), 1200);
			}, this));
		}, this), L.bind(function(err) {
			this.applying = false;
			this.repaint();
			ui.addNotification(null, E('p', _('Failed to apply exit selection:') + ' ' + (err.message || _('Unknown error'))), 'danger');
		}, this));
	},

	statusPanel: function(data) {
		var same, active, badgeText, badgeClass, changed;
		data.mode = data.mode || 'wan_first';
		data.active4 = data.active4 || 'none';
		data.active6 = data.active6 || 'none';
		same = data.active4 === data.active6 && data.active4 !== 'none';
		active = data.active4 !== 'none' ? data.active4 : data.active6;
		badgeText = same ? _('Current exit: %s').format(this.exitLabel(active)) : _('IPv4: %s · IPv6: %s').format(this.exitLabel(data.active4), this.exitLabel(data.active6));
		badgeClass = 'h5net-active' + (active === 'none' ? ' fail' : (active === 'other' ? ' warn' : ''));
		changed = this.pendingMode !== data.mode;

		return E('div', { 'class': 'h5net', id: 'h5net-status' }, [
			this.styleNode(),
			E('div', { 'class': 'h5net-head' }, [
				E('div', {}, [ E('h2', {}, _('Network exits')), E('p', {}, _('Click the connection cards to set the order. The first is preferred and the second is fallback.')) ]),
				E('div', { 'class': badgeClass }, badgeText)
			]),
			E('div', { 'class': 'h5net-note' }, this.statusMessage(data)),
			E('div', { 'class': 'h5net-grid' }, [ this.routeCard('wan', data), this.routeCard('modem', data) ]),
			E('div', { 'class': 'h5net-actions' }, [
				E('button', {
					'class': 'cbi-button cbi-button-apply',
					'disabled': (!changed || this.applying) ? 'disabled' : null,
					'click': L.bind(this.applySelection, this)
				}, this.applying ? _('Applying…') : _('Apply settings'))
			])
		]);
	},

	repaint: function() {
		var old = document.getElementById('h5net-status');
		if (old && this.liveData)
			old.parentNode.replaceChild(this.statusPanel(this.liveData), old);
	},

	refreshStatus: function() {
		return this.statusCommand().then(L.bind(function(res) {
			this.liveData = this.parseStatus(res);
			if (!this.selecting && !this.applying)
				this.pendingMode = this.liveData.mode || 'wan_first';
			this.repaint();
		}, this));
	},

	render: function(res) {
		this.liveData = this.parseStatus(res);
		this.liveData.mode = this.liveData.mode || 'wan_first';
		this.pendingMode = this.liveData.mode;
		this.selecting = false;
		this.applying = false;
		poll.add(L.bind(this.refreshStatus, this), 5);
		return this.statusPanel(this.liveData);
	}
});
