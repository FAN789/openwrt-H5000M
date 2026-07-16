'use strict';
'require view';
'require fs';
'require ui';

function section(raw, label) {
	var marker = '===== ' + label + ':', active = false, output = [];
	(raw || '').split(/\n/).forEach(function(line) {
		if (line.indexOf('===== ') === 0) { active = line.indexOf(marker) === 0; return; }
		if (active && line.trim() && line.trim() !== 'OK') output.push(line.trim());
	});
	return output.join('\n');
}

function pick(text, expression, fallback) {
	var match = (text || '').match(expression);
	return match ? match[1] : fallback;
}

function select(options, value) {
	var node = E('select', { 'class': 'cbi-input-select' }, options.map(function(item) { return E('option', { 'value': item[0] }, item[1]); }));
	if (value != null) node.value = String(value);
	return node;
}

return view.extend({
	load: function() { return fs.exec('/usr/sbin/mt5700m-at', [ 'advanced' ]).catch(function(err) { return { stdout: '', stderr: err.message || String(err) }; }); },

	styleNode: function() { return E('style', {}, [
		'.mt-advanced{max-width:1120px;margin:0 auto}.mt-advanced-head{padding:22px 24px;border-radius:15px;background:linear-gradient(135deg,#263b59,#354d70);color:#fff;margin-bottom:15px}.mt-advanced-head h2{color:#fff;margin:0 0 7px;font-size:24px}.mt-advanced-head p{margin:0;opacity:.84;font-size:13px;line-height:1.55}',
		'.mt-advanced-tabs{display:flex;gap:7px;flex-wrap:wrap;margin:0 0 15px}.mt-advanced-tab{border:1px solid var(--border-color-medium,#d9dde4);background:var(--background-color-high,#fff);border-radius:999px;padding:7px 13px;cursor:pointer}.mt-advanced-tab.active{background:#245b8f;color:#fff;border-color:#245b8f}',
		'.mt-advanced-page{display:none}.mt-advanced-page.active{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:13px}.mt-advanced-card{padding:18px;border:1px solid var(--border-color-medium,#d9dde4);border-radius:13px;background:var(--background-color-high,#fff)}.mt-advanced-card.wide{grid-column:1/-1}',
		'.mt-advanced-card h3{margin:0 0 5px;font-size:15px}.mt-advanced-desc{font-size:12px;color:var(--text-color-medium,#6e7783);margin-bottom:14px;line-height:1.5}.mt-advanced-row{display:grid;grid-template-columns:145px 1fr;gap:10px;align-items:center;margin:11px 0}.mt-advanced-row label{font-size:12px;color:var(--text-color-medium,#6e7783)}.mt-advanced-row input,.mt-advanced-row select{width:100%;box-sizing:border-box}',
		'.mt-advanced-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:15px}.mt-advanced-note{padding:10px 12px;border-radius:8px;background:#fff7e5;color:#795300;font-size:11px;line-height:1.5;margin-top:12px}.mt-advanced-state{display:flex;justify-content:space-between;gap:14px;padding:9px 0;border-bottom:1px solid var(--border-color-low,#edf0f4);font-size:12px}.mt-advanced-state:last-child{border-bottom:0}.mt-advanced-state span{color:var(--text-color-medium,#6e7783)}.mt-advanced-state strong{text-align:right}',
		'@media(max-width:760px){.mt-advanced-page.active{grid-template-columns:1fr}.mt-advanced-row{grid-template-columns:1fr;gap:5px}.mt-advanced-head{padding:20px}}'
	].join('')); },

	confirmRun: function(title, message, args, restartRequired) {
		return ui.showModal(title, [ E('p', {}, message), restartRequired ? E('div', { 'class': 'alert-message warning' }, _('A module restart is required before this change takes effect.')) : null, E('div', { 'class': 'right' }, [
			E('button', { 'type': 'button', 'class': 'btn', 'click': ui.hideModal }, _('Cancel')), ' ',
			E('button', { 'type': 'button', 'class': 'btn cbi-button-negative', 'click': function() { ui.hideModal(); fs.exec('/usr/sbin/mt5700m-at', args).then(function() { ui.addNotification(null, E('p', {}, _('Settings applied.'))); window.setTimeout(function() { window.location.reload(); }, 900); }, function(err) { ui.addNotification(null, E('p', {}, err.message || String(err)), 'danger'); }); } }, _('Apply'))
		]) ]);
	},

	render: function(res) {
		var raw = res.stdout || '', self = this;
		var autoRaw = section(raw, 'Auto dial'), directRaw = section(raw, 'Direct IP'), usbRaw = section(raw, 'USB mode'), interfaceRaw = section(raw, 'Interface mode');
		var autoMatch = autoRaw.match(/\^SETAUTODIAL:\s*(\d+),(\d+),"([^"]*)",?"?([^",]*)"?,?"?([^",]*)"?,?"?([^",]*)"?,(\d+)/);
		var nic = pick(section(raw, 'NIC speed'), /\^TDPCIELANCFG:\s*(\d+)/, '');
		var performance = pick(section(raw, 'Performance mode'), /\^TDPMCFG:\s*(\d+)/, '');
		var hotplug = pick(section(raw, 'SIM hotplug'), /\^TDSIMHP:\s*(\d+)/, '');
		var simSlot = pick(section(raw, 'SIM slot'), /\^SCICHG:\s*(\d+)/, '');
		var thermalMatch = section(raw, 'Thermal control').match(/\^THERMAUTOFUN:\s*(\d+)\s+(\d+)\s+(\d+)/);
		var ca = pick(section(raw, 'NR carrier aggregation'), /\^NRRCCAPQRY:\s*3,(\d+)/, '');
		var vonr = pick(section(raw, 'VoNR'), /\^NRRCCAPQRY:\s*2,(\d+)/, '');
		var dssMatch = section(raw, 'DSS').match(/\^NRRCCAPQRY:\s*5,(\d+),(\d+)/);
		var radioCode = pick(section(raw, 'Radio mode'), /^\^SYSCFGEX:\s*"?([^",\r\n]+)"?/m, '');
		var radioLabels = {
			'00': _('Automatic'),
			'01': 'GSM',
			'02': 'WCDMA',
			'03': 'LTE',
			'08': '5G NR',
			'0302': 'LTE / WCDMA',
			'030201': 'LTE / WCDMA / GSM',
			'0803': '5G NR / LTE',
			'080302': '5G NR / LTE / WCDMA'
		};
		var radioMode = radioLabels[radioCode] ? radioLabels[radioCode] + ' · ' + radioCode : radioCode;
		var interfaceMode = pick(interfaceRaw, /Mode:\s*(\d+)/, ''), postRouteValue = pick(interfaceRaw, /PostRoute:\s*(\d+)/, '');
		var dmzValue = pick(interfaceRaw, /Dmz:\s*([^\n]+)/, '').trim();

		var enabled = select([['1',_('Enabled')],['0',_('Disabled')]], autoMatch ? autoMatch[1] : '1');
		var dialMode = select([['2',_('Ethernet mode')],['1',_('USB mode')]], autoMatch ? autoMatch[2] : '2');
		var protocol = select([['IPV4V6','IPv4 / IPv6'],['IP','IPv4'],['IPV6','IPv6']], autoMatch ? autoMatch[3] : 'IPV4V6');
		var apn = E('input', { 'class':'cbi-input-text', 'placeholder':_('Leave empty to use carrier default'), 'value':autoMatch ? autoMatch[4] : '' });
		var username = E('input', { 'class':'cbi-input-text', 'autocomplete':'off', 'value':autoMatch ? autoMatch[5] : '' });
		var password = E('input', { 'class':'cbi-input-text', 'type':'password', 'autocomplete':'new-password', 'value':autoMatch ? autoMatch[6] : '' });
		var auth = select([['0',_('None')],['1','PAP'],['2','CHAP']], autoMatch ? autoMatch[7] : '0');
		var direct = select([['',_('Select a setting')],['0',_('Disabled')],['1',_('Enabled')]], pick(directRaw, /\^SETDIRECTIP:\s*(\d+)/, ''));
		var nicSpeed = select([['1','RTL8111 · 1 Gbps'],['2','RTL8125 · 2.5 Gbps']], nic);
		var usbMode = select([['0','Linux ECM'],['1','Windows NCM'],['2','Linux ECM · Debug'],['3','Windows NCM · Debug'],['4','Linux NCM'],['5','Linux NCM · Debug'],['6','Windows RNDIS'],['7','Windows MBIM'],['8','PPP']], pick(usbRaw, /(?:^|\n)(\d+)(?:\n|$)/, '4'));
		var ifaceMode = select([['1',_('USB Stick + Ethernet router mode')],['2',_('USB router + Ethernet router mode')],['3',_('Ethernet passthrough mode')]], interfaceMode);
		var postRoute = select([['0',_('Disabled')],['1',_('Enabled')]], postRouteValue);
		var dmz = E('input', { 'class':'cbi-input-text', 'placeholder':'192.168.8.100', 'value':dmzValue.indexOf('not cfg') < 0 ? dmzValue : '' });
		var performanceMode = select([['0',_('Balanced')],['1',_('Performance')]], performance);
		var simHotplug = select([['1',_('Enabled')],['0',_('Disabled')]], hotplug);
		var thermalEnabled = select([['1',_('Enabled')],['0',_('Disabled')]], thermalMatch ? thermalMatch[1] : '1');
		var thermalMimo = select([['0',_('Disabled')],['1',_('Enabled')]], thermalMatch ? thermalMatch[2] : '0');
		var thermalInterval = select([['1','1 s'],['2','2 s'],['3','3 s'],['5','5 s'],['10','10 s'],['30','30 s'],['60','60 s']], thermalMatch ? thermalMatch[3] : '2');
		var caEnabled = select([['1',_('Enabled')],['0',_('Disabled')]], ca);
		var vonrMode = select([['0',_('Disabled')],['1','FR1 VoNR'],['2','FR2 VoNR'],['3','FR1 + FR2 VoNR']], vonr);
		var dssRate = select([['0',_('Disabled')],['1',_('Enabled')]], dssMatch ? dssMatch[1] : '0');
		var dssDmrs = select([['0',_('Disabled')],['1',_('Enabled')]], dssMatch ? dssMatch[2] : '0');

		function row(label, input) { return E('div', { 'class':'mt-advanced-row' }, [ E('label', {}, label), input ]); }
		function action(label, handler) { return E('div', { 'class':'mt-advanced-actions' }, E('button', { 'type':'button', 'class':'btn cbi-button-apply', 'click':handler }, label)); }
		function card(title, desc, body, wide) { return E('section', { 'class':'mt-advanced-card' + (wide ? ' wide' : '') }, [ E('h3', {}, title), E('div', { 'class':'mt-advanced-desc' }, desc) ].concat(body)); }
		function state(label, value) { return E('div', { 'class':'mt-advanced-state' }, [E('span',{},label),E('strong',{},value||'--')]); }

		var pages = {
			connection: E('div', { 'class':'mt-advanced-page active', 'data-page':'connection' }, [
				card(_('Module internal auto-dial (expert)'), _('This controls the modem firmware itself, not QModem. Normally configure APN and dialing on the Connection and Dialing page; change this only for standalone or passthrough deployments.'), [E('div',{'class':'mt-advanced-note'},_('Using both module auto-dial and QModem dialing with different APN settings may cause confusing connection behavior.')),row(_('Automatic dialing'),enabled),row(_('Dial mode'),dialMode),row(_('PDP protocol'),protocol),row('APN',apn),row(_('Username'),username),row(_('Password'),password),row(_('Authentication'),auth),action(_('Apply module setting'),function(){self.confirmRun(_('Apply module auto-dial settings'),_('The module-side mobile data session may disconnect and reconnect.'),['advanced-set','autodial',enabled.value,dialMode.value,protocol.value,apn.value,username.value,password.value,auth.value]);})]),
				card(_('IP passthrough'), _('Assign the mobile-network address directly to the connected host.'), [row(_('IP passthrough'),direct),action(_('Apply settings'),function(){if(!direct.value)return ui.addNotification(null,E('p',{},_('Select an explicit IP passthrough setting first.')),'warning');self.confirmRun(_('Apply IP passthrough'),_('This may interrupt connectivity and change host addressing.'),['advanced-set','direct-ip',direct.value]);})])
			]),
			ports: E('div', { 'class':'mt-advanced-page', 'data-page':'ports' }, [
				card(_('Ethernet controller'), _('Select the hardware profile used by the PCIe Ethernet controller.'), [row(_('Ethernet speed'),nicSpeed),E('div',{'class':'mt-advanced-note'},_('The detected hardware supports both 1 Gbps and 2.5 Gbps profiles.')),action(_('Apply speed'),function(){self.confirmRun(_('Change Ethernet speed'),_('The Ethernet controller profile will be changed.'),['advanced-set','nic-speed',nicSpeed.value],true);})]),
				card(_('USB data mode'), _('Choose the USB network driver profile presented by the module.'), [row(_('USB mode'),usbMode),action(_('Apply USB mode'),function(){self.confirmRun(_('Change USB mode'),_('USB connectivity may disappear until the module restarts.'),['advanced-set','usb-mode',usbMode.value],true);})]),
				card(_('Ethernet operating mode'), _('Control whether Ethernet is routed by the module or receives the mobile IP directly.'), [row(_('Interface mode'),ifaceMode),action(_('Apply interface mode'),function(){self.confirmRun(_('Change interface mode'),_('This changes Ethernet addressing and may disconnect the current session.'),['advanced-set','interface-mode',ifaceMode.value],true);})], true)
			]),
			routing: E('div', { 'class':'mt-advanced-page', 'data-page':'routing' }, [
				card(_('Post-routing'), _('Enable the module post-routing path. This is mutually exclusive with DMZ.'), [row(_('Post-routing'),postRoute),action(_('Apply setting'),function(){self.confirmRun(_('Change post-routing'),_('The mobile data session may need to reconnect.'),['advanced-set','postroute',postRoute.value]);})]),
				card(_('DMZ host'), _('Forward unsolicited inbound traffic to one host on the module LAN.'), [row(_('DMZ address'),dmz),E('div',{'class':'mt-advanced-note'},_('Only addresses from 192.168.8.1 to 192.168.8.254 are accepted. Leave empty to disable DMZ.')),action(_('Apply DMZ'),function(){self.confirmRun(_('Change DMZ host'),_('The selected host may be exposed to the public mobile network.'),['advanced-set','dmz',dmz.value.trim()||'0']);})])
			]),
			radio: E('div', { 'class':'mt-advanced-page', 'data-page':'radio' }, [
				card(_('5G capabilities'), _('Configure modem radio capabilities. Changes normally require an airplane-mode cycle.'), [row(_('Carrier aggregation'),caEnabled),row(_('VoNR mode'),vonrMode),row(_('DSS rate matching'),dssRate),row(_('Additional DMRS'),dssDmrs),action(_('Apply radio capabilities'),function(){ui.showModal(_('Choose a setting to apply'),[E('p',{},_('Apply each radio capability independently to reduce the risk of an invalid combination.')),E('div',{'class':'right'},[E('button',{'type':'button','class':'btn','click':ui.hideModal},_('Cancel')),' ',E('button',{'type':'button','class':'btn','click':function(){ui.hideModal();self.confirmRun(_('Carrier aggregation'),_('Apply the selected carrier aggregation setting?'),['advanced-set','carrier-aggregation',caEnabled.value]);}},_('Carrier aggregation')),' ',E('button',{'type':'button','class':'btn','click':function(){ui.hideModal();self.confirmRun(_('VoNR mode'),_('Apply the selected VoNR mode?'),['advanced-set','vonr',vonrMode.value]);}},'VoNR'),' ',E('button',{'type':'button','class':'btn','click':function(){ui.hideModal();self.confirmRun('DSS',_('Apply the selected DSS settings?'),['advanced-set','dss',dssRate.value,dssDmrs.value]);}},'DSS')])]);})]),
				card(_('Current radio profile'), _('Read-only values reported by the modem.'), [state(_('Radio mode'),radioMode),state(_('SIM slot'),simSlot==='0'?_('External SIM'):_('Internal SIM'))])
			]),
			device: E('div', { 'class':'mt-advanced-page', 'data-page':'device' }, [
				card(_('Performance and SIM'), _('Tune module performance and external SIM handling.'), [row(_('Performance profile'),performanceMode),row(_('SIM hotplug'),simHotplug),action(_('Apply device setting'),function(){ui.showModal(_('Choose a setting to apply'),[E('div',{'class':'right'},[E('button',{'type':'button','class':'btn','click':ui.hideModal},_('Cancel')),' ',E('button',{'type':'button','class':'btn','click':function(){ui.hideModal();self.confirmRun(_('Performance profile'),_('Apply the selected performance profile?'),['advanced-set','performance',performanceMode.value]);}},_('Performance')),' ',E('button',{'type':'button','class':'btn','click':function(){ui.hideModal();self.confirmRun(_('SIM hotplug'),_('Apply the selected SIM hotplug setting?'),['advanced-set','sim-hotplug',simHotplug.value]);}},_('SIM hotplug'))])]);})]),
				card(_('Thermal protection'), _('Configure the module built-in thermal protection polling.'), [row(_('Thermal protection'),thermalEnabled),row(_('Reduce MIMO when hot'),thermalMimo),row(_('Temperature interval'),thermalInterval),action(_('Apply thermal settings'),function(){self.confirmRun(_('Thermal protection'),_('Apply these thermal protection settings?'),['advanced-set','thermal',thermalEnabled.value,thermalMimo.value,thermalInterval.value]);})])
			])
		};

		function switchPage(name, button) {
			Object.keys(pages).forEach(function(key){pages[key].classList.toggle('active',key===name);});
			button.parentNode.querySelectorAll('.mt-advanced-tab').forEach(function(node){node.classList.toggle('active',node===button);});
		}
		var tabs = E('div', { 'class':'mt-advanced-tabs' }, [
			[_('Connection'),'connection'],[_('Ports and modes'),'ports'],[_('Routing'),'routing'],[_('5G capabilities'),'radio'],[_('Device behavior'),'device']
		].map(function(item,index){return E('button',{'type':'button','class':'mt-advanced-tab'+(index?'':' active'),'click':function(){switchPage(item[1],this);}},item[0]);}));

		return E('div', { 'class':'mt-advanced' }, [this.styleNode(),E('section',{'class':'mt-advanced-head'},[E('h2',{},_('Advanced modem settings')),E('p',{},_('Connection, Ethernet, radio and hardware controls supported by this MT5700M firmware.'))]),res.stderr?E('div',{'class':'alert-message warning'},res.stderr):null,tabs,pages.connection,pages.ports,pages.routing,pages.radio,pages.device]);
	},
	handleSave:null,handleSaveApply:null,handleReset:null
});
