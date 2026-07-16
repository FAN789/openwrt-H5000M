'use strict';
'require view';
'require form';
'require rpc';
'require uci';
'require ui';
'require fs';
'require mt5700m.controls as controls';

var callDialStatus = rpc.declare({
	object: 'mt5700m',
	method: 'status',
	expect: { }
});

var callDeviceStatus = rpc.declare({
	object: 'network.device',
	method: 'status',
	params: [ 'name' ],
	expect: { }
});

var callDialLog = rpc.declare({
	object: 'mt5700m',
	method: 'log',
	expect: { }
});

var callDial = rpc.declare({
	object: 'mt5700m',
	method: 'connect',
	expect: { }
});

var callHang = rpc.declare({
	object: 'mt5700m',
	method: 'disconnect',
	expect: { }
});

var callRedial = rpc.declare({
	object: 'mt5700m',
	method: 'redial',
	expect: { }
});

function csvValues(text, prefix) {
	var line = (text || '').split(/\n/).filter(function(item) { return item.indexOf(prefix) === 0; })[0] || '';
	return line.substring(prefix.length).replace(/^[ :]+/, '').replace(/"/g, '').split(',').map(function(value) { return value.trim(); });
}

function hexIPv4(value) {
	if (!/^[0-9a-f]{8}$/i.test(value || ''))
		return '';
	return [ 6, 4, 2, 0 ].map(function(offset) { return parseInt(value.substr(offset, 2), 16); }).join('.');
}

function hexNumber(value) {
	value = String(value || '').replace(/^0x/i, '');
	if (!/^[0-9a-f]+$/i.test(value))
		return 0;
	if (value.length <= 8)
		return parseInt(value, 16);
	return parseInt(value.slice(0, -8), 16) * 4294967296 + parseInt(value.slice(-8), 16);
}

function formatBytes(value) {
	var units = [ 'B', 'KiB', 'MiB', 'GiB', 'TiB' ], index = 0;
	value = Number(value) || 0;
	while (value >= 1024 && index < units.length - 1) { value /= 1024; index++; }
	return (index ? value.toFixed(value >= 10 ? 1 : 2) : String(Math.floor(value))) + ' ' + units[index];
}

function formatDuration(seconds) {
	seconds = Math.max(0, Number(seconds) || 0);
	var days = Math.floor(seconds / 86400), hours = Math.floor(seconds % 86400 / 3600), minutes = Math.floor(seconds % 3600 / 60);
	return (days ? days + _('d') + ' ' : '') + (hours ? hours + _('h') + ' ' : '') + minutes + _('min');
}

function formatRate(value) {
	value = Number(value) || 0;
	if (value >= 1000000000) return (value / 1000000000).toFixed(2) + ' Gbps';
	if (value >= 1000000) return (value / 1000000).toFixed(1) + ' Mbps';
	return value ? Math.round(value / 1000) + ' Kbps' : '--';
}

function parseContexts(raw, activationRaw) {
	var active = {};
	(activationRaw || '').split(/\n/).forEach(function(line) {
		var match = line.match(/^\+CGACT:\s*(\d+),(\d+)/);
		if (match) active[match[1]] = match[2] === '1';
	});
	return (raw || '').split(/\n/).map(function(line) {
		var match = line.match(/^\+CGDCONT:\s*(\d+),"([^"]*)","([^"]*)"/);
		return match ? { cid: match[1], type: match[2], apn: match[3], active: active[match[1]] === true } : null;
	}).filter(Boolean);
}

function parseDetailedSessions(raw) {
	return (raw || '').split(/\n/).map(function(line) {
		var match = line.match(/^\^DCONNSTAT:\s*(\d+)(?:[,，]["“”]?([^,"“”]*)["“”]?[,，](\d+)[,，](\d+)[,，](\d+)(?:[,，](\d+))?)?/);
		return match ? { cid:match[1], apn:match[2] || '', ipv4:match[3] === '1', ipv6:match[4] === '1', type:match[5] || '', ethernet:match[6] === '1' } : null;
	}).filter(function(item) { return item && item.apn; });
}

return view.extend({
	load: function() {
		return uci.load('mt5700m').then(L.bind(function() {
			return callDialStatus().catch(function() { return {}; }).then(L.bind(function(manager) {
				this.manager = manager || {};
				return Promise.all([
					Promise.resolve(this.manager),
					callDeviceStatus(this.manager.network || '').catch(function() { return {}; }),
					fs.exec('/usr/sbin/mt5700m-at', [ 'advanced', 'connection' ]).catch(function(err) { return { stdout: '', stderr: err.message || String(err) }; })
				]);
			}, this));
		}, this));
	},

	styleNode: function() {
		return E('style', {}, [
			'.mtconn-page{max-width:1040px;margin:0 auto}',
			'.mtconn-hero{display:flex;justify-content:space-between;align-items:center;gap:20px;padding:20px 22px;margin-bottom:16px;border:1px solid var(--border-color-medium,#d9dde4);border-radius:15px;background:linear-gradient(135deg,rgba(20,111,217,.10),rgba(0,155,133,.08))}',
			'.mtconn-title{font-size:22px;font-weight:720;margin:0 0 5px}',
			'.mtconn-sub{font-size:13px;color:var(--text-color-medium,#69717d)}',
			'.mtconn-state{display:flex;align-items:center;gap:9px;font-size:14px;font-weight:700;white-space:nowrap}',
			'.mtconn-dot{width:10px;height:10px;border-radius:50%;background:#d79a22;box-shadow:0 0 0 5px rgba(215,154,34,.14)}',
			'.mtconn-state.online .mtconn-dot{background:#0aa378;box-shadow:0 0 0 5px rgba(10,163,120,.14)}',
			'.mtconn-facts{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-bottom:16px}',
			'.mtconn-fact{padding:13px 14px;border:1px solid var(--border-color-medium,#d9dde4);border-radius:11px;background:var(--background-color-high,#fff)}',
			'.mtconn-label{font-size:11px;color:var(--text-color-medium,#69717d);margin-bottom:5px}',
			'.mtconn-value{font-size:14px;font-weight:650;word-break:break-word}',
			'.mtconn-actions{display:flex;flex-wrap:wrap;gap:9px;margin:0 0 18px}',
			'.mtconn-actions .btn{border-radius:9px}',
			'.mtconn-session{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin:16px 0}.mtconn-panel{padding:16px;border:1px solid var(--border-color-medium,#d9dde4);border-radius:13px;background:var(--background-color-high,#fff)}.mtconn-panel h3{margin:0 0 5px;font-size:15px}.mtconn-panel-desc{margin:0 0 11px;color:var(--text-color-medium,#69717d);font-size:11px;line-height:1.45}.mtconn-panel-row{display:flex;justify-content:space-between;gap:14px;padding:8px 0;border-bottom:1px solid var(--border-color-low,#edf0f4);font-size:12px}.mtconn-panel-row:last-child{border-bottom:0}.mtconn-panel-row span{color:var(--text-color-medium,#69717d)}.mtconn-panel-row strong{text-align:right;word-break:break-all}.mtconn-panel-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:12px}',
			'.mtconn-pdp{margin:16px 0;padding:16px;border:1px solid var(--border-color-medium,#d9dde4);border-radius:13px;background:var(--background-color-high,#fff)}.mtconn-pdp-head{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:10px}.mtconn-pdp-head h3{font-size:15px;margin:0 0 4px}.mtconn-pdp-head p{font-size:11px;color:var(--text-color-medium,#69717d);margin:0;line-height:1.45}.mtconn-pdp-row{display:grid;grid-template-columns:58px 100px 1fr 90px auto;align-items:center;gap:10px;padding:9px 0;border-top:1px solid var(--border-color-low,#edf0f4);font-size:12px}.mtconn-pdp-state{font-weight:650;color:#7b8794}.mtconn-pdp-state.on{color:#08775d}.mtconn-pdp-actions{display:flex;gap:6px;justify-content:flex-end}',
			'.mtconn-config{margin:16px 0;padding:18px 20px;border:1px solid var(--border-color-medium,#d9dde4);border-radius:13px;background:var(--background-color-high,#fff)}.mtconn-config-head{margin-bottom:10px}.mtconn-config-head h3{margin:0 0 5px;font-size:16px}.mtconn-config-head p{margin:0;color:var(--text-color-medium,#69717d);font-size:12px;line-height:1.5}.mtconn-config .cbi-map>h2,.mtconn-config .cbi-map-descr,.mtconn-config .cbi-section>h3{display:none}.mtconn-config .cbi-section{margin:0;padding:0;border:0;box-shadow:none}.mtconn-config .cbi-section-node{padding:0}.mtconn-config .cbi-value{padding:9px 0;border-bottom:1px solid var(--border-color-low,#edf0f4)}.mtconn-config .cbi-value:last-child{border-bottom:0}',
			'.mtconn-advanced-body{padding:0 18px 18px}.mtconn-advanced-body .mtconn-pdp{border:0;padding:0;margin:18px 0 0;box-shadow:none}.mtconn-advanced-body .mt-control-section{margin-top:18px}',
			'.mtconn-log{margin-top:16px;border:1px solid var(--border-color-medium,#d9dde4);border-radius:11px;background:var(--background-color-high,#fff)}',
			'.mtconn-log summary{cursor:pointer;padding:13px 15px;font-weight:650}',
			'.mtconn-log pre{max-height:260px;overflow:auto;margin:0;padding:14px 15px;border-top:1px solid var(--border-color-low,#edf0f4);font-size:11px;white-space:pre-wrap}',
			'@media(max-width:720px){.mtconn-hero{display:block}.mtconn-state{margin-top:14px}.mtconn-facts{grid-template-columns:repeat(2,minmax(0,1fr))}.mtconn-session{grid-template-columns:1fr}.mtconn-pdp-row{grid-template-columns:48px 80px 1fr}.mtconn-pdp-row .mtconn-pdp-state,.mtconn-pdp-actions{grid-column:3}.mtconn-config{padding:16px}}',
			'@media(max-width:420px){.mtconn-facts{grid-template-columns:1fr}}'
		].join(''));
	},

	fact: function(label, value) {
		return E('div', { 'class': 'mtconn-fact mt-ui-card' }, [
			E('div', { 'class': 'mtconn-label' }, label),
			E('div', { 'class': 'mtconn-value' }, value || '--')
		]);
	},

	panelRow: function(label, value) {
		return E('div', { 'class': 'mtconn-panel-row' }, [ E('span', {}, label), E('strong', {}, value || '--') ]);
	},

	editPdp: function(context) {
		var cid = E('input', { 'class':'cbi-input-text', 'type':'number', 'min':'1', 'max':'11', 'value':context ? context.cid : '1' });
		var type = controls.select([['IPV4V6','IPv4 / IPv6'],['IP','IPv4'],['IPV6','IPv6']], context ? context.type : 'IPV4V6');
		var apn = E('input', { 'class':'cbi-input-text', 'maxlength':'99', 'placeholder':_('Carrier default'), 'value':context ? context.apn : '' });
		return ui.showModal(context ? _('Edit PDP context') : _('Add PDP context'), [
			E('p', {}, _('This changes a module-native PDP profile. The OpenWrt dialing profile above remains the normal place to configure APN.')),
			controls.row('CID', cid), controls.row(_('IP protocol'), type), controls.row('APN', apn),
			E('div', { 'class':'right' }, [ E('button', { 'class':'btn', 'click':ui.hideModal }, _('Cancel')), ' ', E('button', { 'class':'btn cbi-button-apply', 'click':function() {
				var cidValue = String(cid.value || '');
				if (!/^(?:[1-9]|1[01])$/.test(cidValue) || /[",\r\n]/.test(apn.value || ''))
					return ui.addNotification(null, E('p', {}, _('Enter a CID from 1 to 11 and a valid APN.')), 'warning');
				ui.hideModal();
				fs.exec('/usr/sbin/mt5700m-at', [ 'pdp-set', cidValue, type.value, apn.value.trim() ]).then(function() { window.location.reload(); }, function(err) { ui.addNotification(null, E('p', {}, err.message || String(err)), 'danger'); });
			} }, _('Save')) ])
		]);
	},

	loadLog: function(details, output) {
		if (!details.open || details.getAttribute('data-loaded') === '1')
			return;

		details.setAttribute('data-loaded', '1');
		output.textContent = _('Loading dialing log…');
		callDialLog().then(function(result) {
			output.textContent = result.log || _('No dialing log is available.');
		}).catch(function(err) {
			details.setAttribute('data-loaded', '0');
			output.textContent = err.message || String(err);
		});
	},

	runAction: function(action, success, confirmText) {
		var run = function() {
			ui.showModal(_('Working…'), [ E('p', { 'class': 'spinning' }, _('Applying the connection action…')) ]);
			return action().then(function() {
				ui.hideModal();
				ui.addNotification(null, E('p', {}, success));
				window.setTimeout(function() { window.location.reload(); }, 1200);
			}).catch(function(err) {
				ui.hideModal();
				ui.addNotification(null, E('p', {}, err.message || String(err)), 'danger');
			});
		};

		if (!confirmText)
			return run();

		return ui.showModal(_('Confirm Action'), [
			E('p', {}, confirmText),
			E('div', { 'class': 'right' }, [
				E('button', { 'class': 'btn', 'click': ui.hideModal }, _('Cancel')),
				' ',
				E('button', { 'class': 'btn cbi-button-action', 'click': function() { ui.hideModal(); run(); } }, _('Continue'))
			])
		]);
	},

	render: function(results) {
		var manager = this.manager || results[0] || {};
		var self = this;

		var dial = results[0] || {};
		var device = results[1] || {};
		var moduleSettings = results[2] || {};
		var moduleRaw = moduleSettings.stdout || '';
		var online = dial.connected === true && device.up === true && device.carrier !== false;
		var m = new form.Map('mt5700m');
		var s, o;
		var logOutput = E('pre', { 'class':'mt-ui-details-body' }, _('Expand to load the dialing log.'));
		var logDetails = E('details', {
			'class': 'mtconn-log mt-ui-details',
			'toggle': function(ev) { self.loadLog(ev.currentTarget, logOutput); }
		}, [
			E('summary', {}, [
				E('span', { 'class':'mt-ui-summary-copy' }, E('span', { 'class':'mt-ui-summary-title' }, _('Recent dialing log'))),
				E('span', { 'class':'mt-ui-chevron', 'aria-hidden':'true' }, '›')
			]),
			logOutput
		]);

		s = m.section(form.NamedSection, 'connection', 'connection');
		s.anonymous = true;

		o = s.option(form.Flag, 'enabled', _('Enable automatic dialing'));
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.Value, 'apn', _('APN'));
		o.placeholder = _('Automatic');
		o.rmempty = true;

		o = s.option(form.ListValue, 'pdp_type', _('IP protocol'));
		o.value('ip', _('IPv4'));
		o.value('ipv6', _('IPv6'));
		o.value('ipv4v6', _('IPv4 / IPv6'));
		o.default = 'ipv4v6';
		o.rmempty = false;

		o = s.option(form.ListValue, 'auth', _('Authentication'));
		o.value('none', _('None'));
		o.value('pap', 'PAP');
		o.value('chap', 'CHAP');
		o.default = 'none';

		o = s.option(form.Value, 'username', _('Username'));
		o.depends('auth', 'pap');
		o.depends('auth', 'chap');

		o = s.option(form.Value, 'password', _('Password'));
		o.password = true;
		o.depends('auth', 'pap');
		o.depends('auth', 'chap');

		o = s.option(form.Value, 'metric', _('Route metric'));
		o.datatype = 'uinteger';
		o.default = '50';
		o.description = _('A smaller value gives this mobile connection a higher route priority.');

		o = s.option(form.DynamicList, 'dns_list', _('Custom DNS'));
		o.datatype = 'ipaddr';
		o.description = _('Leave empty to use DNS supplied by the mobile network.');

		var autoRaw = controls.section(moduleRaw, 'Auto dial');
		var interfaceRaw = controls.section(moduleRaw, 'Interface mode');
		var autoMatch = autoRaw.match(/\^SETAUTODIAL:\s*(\d+),(\d+),"([^"]*)",?"?([^",]*)"?,?"?([^",]*)"?,?"?([^",]*)"?,(\d+)/);
		var enabled = controls.select([['1',_('Enabled')],['0',_('Disabled')]], autoMatch ? autoMatch[1] : '1');
		var dialMode = controls.select([['0',_('Module internal dialing')],['1',_('Host dialing over USB')],['2',_('Host dialing over Ethernet')]], autoMatch ? autoMatch[2] : '1');
		var protocol = controls.select([['IPV4V6','IPv4 / IPv6'],['IP','IPv4'],['IPV6','IPv6']], autoMatch ? autoMatch[3] : 'IPV4V6');
		var moduleApn = E('input', { 'class':'cbi-input-text', 'placeholder':_('Leave empty to use carrier default'), 'value':autoMatch ? autoMatch[4] : '' });
		var moduleUsername = E('input', { 'class':'cbi-input-text', 'autocomplete':'off', 'value':autoMatch ? autoMatch[5] : '' });
		var modulePassword = E('input', { 'class':'cbi-input-text', 'type':'password', 'autocomplete':'new-password', 'value':autoMatch ? autoMatch[6] : '' });
		var moduleAuth = controls.select([['0',_('None')],['1','PAP'],['2','CHAP']], autoMatch ? autoMatch[7] : '0');
		var postRouteValue = controls.pick(interfaceRaw, /PostRoute:\s*(\d+)/, '');
		var dmzValue = controls.pick(interfaceRaw, /Dmz:\s*([^\n]+)/, '').trim();
		var postRoute = controls.select([['2',_('Disabled')],['1',_('Enabled')]], postRouteValue === '1' ? '1' : '2');
		var dmz = E('input', { 'class':'cbi-input-text', 'placeholder':'192.168.8.100', 'value':dmzValue.indexOf('not cfg') < 0 ? dmzValue : '' });
		var ndis = csvValues(controls.section(moduleRaw, 'Data session'), '^NDISSTATQRY');
		var detailedSessions = parseDetailedSessions(controls.section(moduleRaw, 'Detailed sessions'));
		var directIpValue = controls.pick(controls.section(moduleRaw, 'Direct IP'), /\^SETDIRECTIP:\s*(\d+)/, '0');
		var directIp = controls.select([['0',_('Disabled')],['1',_('Enabled')]], directIpValue);
		var dhcp4 = csvValues(controls.section(moduleRaw, 'IPv4 lease'), '^DHCP');
		var dhcp6 = csvValues(controls.section(moduleRaw, 'IPv6 lease'), '^DHCPV6');
		var capability = controls.pick(controls.section(moduleRaw, 'IP capability'), /\^IPV6CAP:\s*(\w+)/, '');
		var flow = csvValues(controls.section(moduleRaw, 'Data flow'), '^DSFLOWQRY');
		var mtu = csvValues(controls.section(moduleRaw, 'MTU'), '^CGMTU');
		var pdpAddress = csvValues(controls.section(moduleRaw, 'PDP address'), '+CGPADDR');
		var contexts = parseContexts(controls.section(moduleRaw, 'PDP contexts'), controls.section(moduleRaw, 'PDP activation'));
		var ipv4Connected = ndis[0] === '1' && ndis[4] === 'IPV4';
		var ipv6Connected = ndis[5] === '1' && ndis[8] === 'IPV6';
		var capabilityNames = { '1':_('IPv4 only'), '2':_('IPv6 only'), '7':_('IPv4 / IPv6 · same APN'), '0B':_('IPv4 / IPv6 · separate APNs'), '0b':_('IPv4 / IPv6 · separate APNs') };
		var sessionPanels = E('div', { 'class':'mtconn-session' }, [
			E('section', { 'class':'mtconn-panel mt-ui-card' }, [
				E('h3', {}, _('Network session')),
				E('p', { 'class':'mtconn-panel-desc' }, _('Addresses and DNS supplied directly by the MT5700M mobile network session.')),
				self.panelRow('IPv4', ipv4Connected ? _('Connected') : _('Disconnected')),
				self.panelRow(_('IPv4 address'), hexIPv4(dhcp4[0]) || pdpAddress[1]),
				self.panelRow(_('IPv4 gateway'), hexIPv4(dhcp4[2])),
				self.panelRow(_('IPv4 DNS'), [ hexIPv4(dhcp4[4]), hexIPv4(dhcp4[5]) ].filter(Boolean).join(' · ')),
				self.panelRow('IPv6', ipv6Connected ? _('Connected') : _('Disconnected')),
				self.panelRow(_('IPv6 address'), dhcp6[0]),
				self.panelRow(_('IPv6 DNS'), [ dhcp6[4], dhcp6[5] ].filter(function(value) { return value && value !== '::'; }).join(' · ')),
				self.panelRow(_('IP capability'), capabilityNames[capability] || capability),
				self.panelRow('MTU', mtu[1] && mtu[1] !== '0' ? mtu[1] : _('Network default'))
			]),
			E('section', { 'class':'mtconn-panel mt-ui-card' }, [
				E('h3', {}, _('Session usage')),
				E('p', { 'class':'mtconn-panel-desc' }, _('Counters are maintained by the module and are independent of OpenWrt interface statistics.')),
				self.panelRow(_('Current session duration'), formatDuration(hexNumber(flow[0]))),
				self.panelRow(_('Current transmitted'), formatBytes(hexNumber(flow[1]))),
				self.panelRow(_('Current received'), formatBytes(hexNumber(flow[2]))),
				self.panelRow(_('Total duration'), formatDuration(hexNumber(flow[3]))),
				self.panelRow(_('Total transmitted'), formatBytes(hexNumber(flow[4]))),
				self.panelRow(_('Total received'), formatBytes(hexNumber(flow[5]))),
				self.panelRow(_('Network maximum downlink'), formatRate(dhcp4[6] || dhcp6[6])),
				self.panelRow(_('Network maximum uplink'), formatRate(dhcp4[7] || dhcp6[7])),
				E('div', { 'class':'mtconn-panel-actions' }, E('button', { 'class':'btn', 'click':function() {
					controls.confirmRun(_('Clear module traffic counters'), _('This permanently clears current and accumulated MT5700M data-flow counters.'), [ 'flow-clear' ]);
				} }, _('Clear counters')))
			])
		]);
		if (detailedSessions.length)
			sessionPanels.appendChild(E('section', { 'class':'mtconn-panel mt-ui-card', 'style':'grid-column:1/-1' }, [
				E('h3', {}, _('Module data sessions')),
				E('p', { 'class':'mtconn-panel-desc' }, _('Active PDP sessions reported by the MT5700M firmware.'))
			].concat(detailedSessions.map(function(item) {
				var type = item.type === '1' ? _('Module application') : item.type === '2' ? _('Host NDIS') : _('Other');
				return self.panelRow('CID ' + item.cid + ' · ' + (item.apn || _('Carrier default')), [item.ipv4 ? 'IPv4' : '', item.ipv6 ? 'IPv6' : '', item.ethernet ? _('Ethernet') : '', type].filter(Boolean).join(' · '));
			}))));
		var pdpPanel = E('section', { 'class':'mtconn-pdp mt-ui-card' }, [
			E('div', { 'class':'mtconn-pdp-head' }, [
				E('div', {}, [ E('h3', {}, _('Module PDP contexts')), E('p', {}, _('Advanced module-native profiles. IMS contexts are protected from editing; normal OpenWrt users should configure APN in the dialing profile above.')) ]),
				E('button', { 'class':'btn', 'click':function() { self.editPdp(null); } }, _('Add profile'))
			])
		].concat(contexts.length ? contexts.map(function(context) {
			var reserved = context.cid === '0' || context.cid === '5' || context.cid === '6' || String(context.apn || '').toLowerCase() === 'ims';
			return E('div', { 'class':'mtconn-pdp-row' }, [
				E('strong', {}, 'CID ' + context.cid), E('span', {}, context.type), E('span', {}, context.apn || _('Carrier default')),
				E('span', { 'class':'mtconn-pdp-state' + (context.active ? ' on' : '') }, context.active ? _('Active') : _('Inactive')),
				E('div', { 'class':'mtconn-pdp-actions' }, reserved ? E('span', {}, String(context.apn || '').toLowerCase() === 'ims' ? _('IMS reserved') : _('System reserved')) : [
					E('button', { 'class':'btn', 'click':function() { self.editPdp(context); } }, _('Edit')),
					E('button', { 'class':'btn', 'click':function() { controls.confirmRun(context.active ? _('Deactivate PDP context') : _('Activate PDP context'), _('Changing a module PDP context can interrupt mobile service.'), [ 'pdp-state', context.active ? '0' : '1', context.cid ]); } }, context.active ? _('Deactivate') : _('Activate')),
					E('button', { 'class':'btn cbi-button-negative', 'click':function() { controls.confirmRun(_('Remove PDP context'), _('Remove CID %s from the module?').format(context.cid), [ 'pdp-remove', context.cid ]); } }, _('Remove'))
				])
			]);
		}) : [ E('div', { 'class':'alert-message notice' }, _('No PDP contexts were reported.')) ]));
		var moduleControls = E('section', { 'class':'mt-control-section' }, [
			E('div', { 'class':'mt-control-section-head' }, [
				E('h3', {}, _('MT5700M data path')),
				E('p', {}, _('Module-side dialing and inbound-routing controls. Most OpenWrt installations should keep host dialing selected.'))
			]),
			moduleSettings.stderr ? E('div', { 'class':'alert-message warning' }, moduleSettings.stderr) : null,
			E('div', { 'class':'mt-control-grid' }, [
				controls.card(_('Module dialing policy'), _('Select how the MT5700M firmware exposes its mobile data session.'), [
					E('div', { 'class':'mt-control-note' }, _('Use one dialing owner for each data path. With the integrated OpenWrt service, keep host dialing over USB selected to avoid repeated reconnects.')),
					controls.row(_('Automatic dialing'), enabled),
					controls.row(_('Dial mode'), dialMode),
					controls.row(_('PDP protocol'), protocol),
					controls.row('APN', moduleApn),
					controls.row(_('Username'), moduleUsername),
					controls.row(_('Password'), modulePassword),
					controls.row(_('Authentication'), moduleAuth),
					controls.action(_('Apply module dialing'), function() {
						controls.confirmRun(_('Apply MT5700M dialing settings'), _('The mobile data session may disconnect and reconnect.'), [ 'advanced-set', 'autodial', enabled.value, dialMode.value, protocol.value, moduleApn.value, moduleUsername.value, modulePassword.value, moduleAuth.value ]);
					})
				]),
				controls.card(_('Inbound routing'), _('Optional module-side forwarding for devices connected behind the MT5700M data path.'), [
					controls.row(_('IP passthrough'), directIp),
					E('div', { 'class':'mt-control-note' }, _('IP passthrough is an original-manager compatibility feature. Keep it disabled when OpenWrt owns the mobile connection.')),
					controls.action(_('Apply IP passthrough'), function() {
						controls.confirmRun(_('Change IP passthrough'), _('Changing passthrough can remove the module management address and interrupt connectivity.'), [ 'advanced-set', 'direct-ip', directIp.value ], true);
					}),
					controls.row(_('Post-routing'), postRoute),
					E('div', { 'class':'mt-control-note' }, _('Post-routing and DMZ are mutually exclusive. Leave both disabled unless the module itself is providing the downstream LAN.')),
					controls.action(_('Apply post-routing'), function() {
						controls.confirmRun(_('Change post-routing'), _('The module must restart or cycle airplane mode before the new routing path is used.'), [ 'advanced-set', 'postroute', postRoute.value ], true);
					}),
					controls.row(_('DMZ address'), dmz),
					controls.action(_('Apply DMZ'), function() {
						controls.confirmRun(_('Change DMZ host'), _('The selected IPv4 host may be exposed to unsolicited traffic from the mobile network.'), [ 'advanced-set', 'dmz', dmz.value.trim() || '0' ]);
					})
				])
			])
		]);

		return m.render().then(function(formNode) {
			return E('div', { 'class': 'mtconn-page mt-ui-page' }, [
				self.styleNode(),
				controls.styleNode(),
				manager.usb_state && manager.usb_state !== 'normal' ? E('div', { 'class':'alert-message warning' }, _('The MT5700M is not in normal USB mode. Connection settings remain available, but dialing cannot start.')) : null,
				E('section', { 'class': 'mtconn-hero mt-ui-hero' }, [
					E('div', {}, [
						E('h2', { 'class': 'mtconn-title' }, _('Mobile data')),
						E('div', { 'class': 'mtconn-sub' }, _('Configure how the MT5700M connects to the mobile network.'))
					]),
					E('div', { 'class': 'mtconn-state' + (online ? ' online' : '') }, [
						E('span', { 'class': 'mtconn-dot' }),
						online ? _('Connected') : _('Disconnected')
					])
				]),
				E('div', { 'class': 'mtconn-facts' }, [
					self.fact(_('Automatic dialing'), uci.get('mt5700m', 'connection', 'enabled') === '0' ? _('Disabled') : _('Enabled')),
					self.fact(_('Network interface'), manager.network),
					self.fact('IPv4', ipv4Connected ? _('Connected') : _('Disconnected')),
					self.fact('IPv6', ipv6Connected ? _('Connected') : _('Disconnected'))
				]),
				E('div', { 'class': 'mtconn-actions' }, online ? [
					E('button', { 'class': 'btn cbi-button-action', 'click': function() { return self.runAction(callRedial, _('Redial started.'), _('The 5G connection will be interrupted briefly while the modem redials.')); } }, _('Redial')),
					E('button', { 'class': 'btn cbi-button-negative', 'click': function() { return self.runAction(callHang, _('Connection stopped.'), _('Disconnect the mobile data connection now?')); } }, _('Disconnect'))
				] : [
					E('button', { 'class': 'btn cbi-button-action', 'click': function() { return self.runAction(callDial, _('Dialing started.')); } }, _('Connect'))
				]),
				E('section', { 'class':'mtconn-config mt-ui-card' }, [
					E('div', { 'class':'mtconn-config-head' }, [
						E('h3', {}, _('Connection settings')),
						E('p', {}, _('APN is normally detected automatically. Save changes, then redial to use the new settings.'))
					]),
					formNode
				]),
				sessionPanels,
				E('details', { 'class':'mtconn-advanced mt-ui-details' }, [
					E('summary', {}, [
						E('span', { 'class':'mt-ui-summary-copy' }, [
							E('span', { 'class':'mt-ui-summary-title' }, _('Advanced connection tools')),
							E('span', { 'class':'mt-ui-summary-desc' }, _('PDP profiles, module dialing modes and inbound routing for troubleshooting or special deployments.'))
						]),
						E('span', { 'class':'mt-ui-chevron', 'aria-hidden':'true' }, '›')
					]),
					E('div', { 'class':'mtconn-advanced-body mt-ui-details-body' }, [ pdpPanel, moduleControls ])
				]),
				logDetails
			]);
		});
	}
});
