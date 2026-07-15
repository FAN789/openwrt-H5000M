'use strict';
'require view';
'require form';

return view.extend({
	render: function() {
		var m, s, o;

		m = new form.Map('mt5700m', _('Module connection'));
		m.description = _('Choose how this manager communicates with the MT5700M. Auto mode is recommended and normally requires no changes.');

		s = m.section(form.NamedSection, 'settings', 'mt5700m', _('AT communication'));
		s.anonymous = true;
		s.description = _('Changes here affect only the management channel; they do not change the mobile network or APN.');

		o = s.option(form.Flag, 'enabled', _('Enable module management'));
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.ListValue, 'mode', _('Connection method'));
		o.value('auto', _('Automatic (recommended)'));
		o.value('serial', _('Serial Port'));
		o.value('network', _('Network TCP'));
		o.default = 'auto';
		o.rmempty = false;

		o = s.option(form.Value, 'at_port', _('AT Serial Port'));
		o.placeholder = '/dev/ttyUSB1';
		o.depends('mode', 'serial');
		o.rmempty = true;

		o = s.option(form.Value, 'host', _('AT Host'));
		o.datatype = 'host';
		o.default = '192.168.8.1';
		o.rmempty = false;
		o.depends('mode', 'network');

		o = s.option(form.Value, 'port', _('AT Port'));
		o.datatype = 'port';
		o.default = '20249';
		o.rmempty = false;
		o.depends('mode', 'network');

		o = s.option(form.Value, 'timeout', _('Response timeout'));
		o.datatype = 'range(1,60)';
		o.default = '8';
		o.rmempty = false;

		return m.render();
	}
});
