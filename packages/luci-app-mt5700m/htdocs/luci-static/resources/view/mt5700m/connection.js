'use strict';
'require view';
'require form';
'require rpc';
'require uci';
'require ui';

var callDialStatus = rpc.declare({
	object: 'qmodem',
	method: 'dial_status',
	params: [ 'config_section' ],
	expect: { }
});

var callDeviceStatus = rpc.declare({
	object: 'network.device',
	method: 'status',
	params: [ 'name' ],
	expect: { }
});

var callDialLog = rpc.declare({
	object: 'qmodem',
	method: 'get_dial_log',
	params: [ 'config_section' ],
	expect: { }
});

var callDial = rpc.declare({
	object: 'qmodem',
	method: 'modem_dial',
	params: [ 'config_section' ],
	expect: { }
});

var callHang = rpc.declare({
	object: 'qmodem',
	method: 'modem_hang',
	params: [ 'config_section' ],
	expect: { }
});

var callRedial = rpc.declare({
	object: 'qmodem',
	method: 'modem_redial',
	params: [ 'config_section' ],
	expect: { }
});

return view.extend({
	findModem: function() {
		var sections = uci.sections('qmodem', 'modem-device');

		return sections.find(function(section) {
			var identity = [ section.name, section.alias, section.manufacturer, section.platform ].join(' ').toLowerCase();
			return /mt5700|huawei|hisilicon/.test(identity) || section.at_port === '/dev/ttyUSB1';
		}) || sections[0];
	},

	load: function() {
		return uci.load('qmodem').then(L.bind(function() {
			var section = this.findModem();

			this.modem = section || null;
			if (!section)
				return [];

			return Promise.all([
				callDialStatus(section['.name']).catch(function() { return {}; }),
				callDeviceStatus(section.network || section.data_interface || '').catch(function() { return {}; })
			]);
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
			'.mtconn-log{margin-top:16px;border:1px solid var(--border-color-medium,#d9dde4);border-radius:11px;background:var(--background-color-high,#fff)}',
			'.mtconn-log summary{cursor:pointer;padding:13px 15px;font-weight:650}',
			'.mtconn-log pre{max-height:260px;overflow:auto;margin:0;padding:14px 15px;border-top:1px solid var(--border-color-low,#edf0f4);font-size:11px;white-space:pre-wrap}',
			'@media(max-width:720px){.mtconn-hero{display:block}.mtconn-state{margin-top:14px}.mtconn-facts{grid-template-columns:repeat(2,minmax(0,1fr))}}',
			'@media(max-width:420px){.mtconn-facts{grid-template-columns:1fr}}'
		].join(''));
	},

	fact: function(label, value) {
		return E('div', { 'class': 'mtconn-fact' }, [
			E('div', { 'class': 'mtconn-label' }, label),
			E('div', { 'class': 'mtconn-value' }, value || '--')
		]);
	},

	loadLog: function(section, details, output) {
		if (!details.open || details.getAttribute('data-loaded') === '1')
			return;

		details.setAttribute('data-loaded', '1');
		output.textContent = _('Loading dialing log…');
		callDialLog(section).then(function(result) {
			output.textContent = result.log || _('No dialing log is available.');
		}).catch(function(err) {
			details.setAttribute('data-loaded', '0');
			output.textContent = err.message || String(err);
		});
	},

	runAction: function(section, action, success, confirmText) {
		var run = function() {
			ui.showModal(_('Working…'), [ E('p', { 'class': 'spinning' }, _('Applying the connection action…')) ]);
			return action(section).then(function() {
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
		var modem = this.modem;
		var self = this;

		if (!modem)
			return E('div', { 'class': 'alert-message warning' }, _('No QModem-managed modem was found. Check the module connection and QModem service.'));

		var dial = results[0] || {};
		var device = results[1] || {};
		var online = String(dial.running || '') === 'true' && device.up === true && device.carrier !== false;
		var dialing = String(dial.running || '') === 'true';
		var section = modem['.name'];
		var m = new form.Map('qmodem', _('Mobile connection'));
		var s, o;
		var displayName = modem.name || modem.alias || 'MT5700M';
		if (/^mt5700m-cn$/i.test(displayName))
			displayName = 'MT5700M-CN';
		var logOutput = E('pre', {}, _('Expand to load the dialing log.'));
		var logDetails = E('details', {
			'class': 'mtconn-log',
			'toggle': function(ev) { self.loadLog(section, ev.currentTarget, logOutput); }
		}, [
			E('summary', {}, _('Recent dialing log')),
			logOutput
		]);

		m.description = _('The MT5700M interface and QModem dialing backend now share one configuration. Saving these fields updates the active dialing profile.');

		s = m.section(form.NamedSection, 'main', 'main', _('Dialing service'));
		s.anonymous = true;
		o = s.option(form.Flag, 'enable_dial', _('Enable automatic dialing'));
		o.default = '1';
		o.rmempty = false;

		s = m.section(form.NamedSection, section, 'modem-device', _('Mobile network profile'));
		s.anonymous = true;
		s.tab('general', _('Connection'));
		s.tab('advanced', _('Advanced'));

		o = s.taboption('general', form.Flag, 'enable_dial', _('Use this modem for dialing'));
		o.default = '1';
		o.rmempty = false;

		o = s.taboption('general', form.Value, 'apn', _('APN'));
		o.placeholder = _('Automatic');
		o.rmempty = true;

		o = s.taboption('general', form.ListValue, 'pdp_type', _('IP protocol'));
		o.value('ip', _('IPv4'));
		o.value('ipv6', _('IPv6'));
		o.value('ipv4v6', _('IPv4 / IPv6'));
		o.default = 'ipv4v6';
		o.rmempty = false;

		o = s.taboption('advanced', form.ListValue, 'auth', _('Authentication'));
		o.value('none', _('None'));
		o.value('pap', 'PAP');
		o.value('chap', 'CHAP');
		o.value('MsChapV2', 'MS-CHAPv2');
		o.default = 'none';

		o = s.taboption('advanced', form.Value, 'username', _('Username'));
		o.depends('auth', 'pap');
		o.depends('auth', 'chap');
		o.depends('auth', 'MsChapV2');

		o = s.taboption('advanced', form.Value, 'password', _('Password'));
		o.password = true;
		o.depends('auth', 'pap');
		o.depends('auth', 'chap');
		o.depends('auth', 'MsChapV2');

		o = s.taboption('advanced', form.Value, 'metric', _('Route metric'));
		o.datatype = 'uinteger';
		o.default = '50';
		o.description = _('A smaller value gives this mobile connection a higher route priority.');

		o = s.taboption('advanced', form.DynamicList, 'dns_list', _('Custom DNS'));
		o.datatype = 'ipaddr';
		o.description = _('Leave empty to use DNS supplied by the mobile network.');

		return m.render().then(function(formNode) {
			return E('div', { 'class': 'mtconn-page' }, [
				self.styleNode(),
				E('section', { 'class': 'mtconn-hero' }, [
					E('div', {}, [
						E('h2', { 'class': 'mtconn-title' }, displayName),
						E('div', { 'class': 'mtconn-sub' }, _('QModem manages detection and dialing; this page provides the device-focused controls.'))
					]),
					E('div', { 'class': 'mtconn-state' + (online ? ' online' : '') }, [
						E('span', { 'class': 'mtconn-dot' }),
						online ? _('Connected') : _('Disconnected')
					])
				]),
				E('div', { 'class': 'mtconn-facts' }, [
					self.fact(_('Dialing process'), dialing ? _('Running') : _('Stopped')),
					self.fact(_('Network interface'), modem.network || modem.data_interface),
					self.fact(_('Supported modes'), modem.mode || (Array.isArray(modem.modes) ? modem.modes.join(' / ') : modem.modes)),
					self.fact(_('Route metric'), modem.metric || '50')
				]),
				E('div', { 'class': 'mtconn-actions' }, [
					E('button', { 'class': 'btn cbi-button-action', 'click': function() { return self.runAction(section, callRedial, _('Redial started.'), _('The 5G connection will be interrupted briefly while the modem redials.')); } }, _('Redial')),
					E('button', { 'class': 'btn', 'click': function() { return self.runAction(section, callDial, _('Dialing started.')); } }, _('Connect')),
					E('button', { 'class': 'btn cbi-button-negative', 'click': function() { return self.runAction(section, callHang, _('Connection stopped.'), _('Disconnect the mobile data connection now?')); } }, _('Disconnect'))
				]),
				E('div', { 'class': 'alert-message notice' }, _('After changing APN, IP protocol or authentication, save the configuration and then redial to apply it.')),
				formNode,
				logDetails
			]);
		});
	}
});
