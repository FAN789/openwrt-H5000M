'use strict';
'require view';
'require form';

return view.extend({
	render: function() {
		var m, s, o;

		m = new form.Map('mt5700m', _('MT5700M Management'));
		m.description = _('Configure the AT channel used by the native LuCI pages. Auto mode uses the QModem-discovered serial port first, then falls back to the modem network AT endpoint.');

		s = m.section(form.NamedSection, 'settings', 'mt5700m');
		s.anonymous = true;

		o = s.option(form.Flag, 'enabled', _('Enable'));
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.ListValue, 'mode', _('AT Channel'));
		o.value('auto', _('Auto'));
		o.value('serial', _('Serial Port'));
		o.value('network', _('Network TCP'));
		o.default = 'auto';
		o.rmempty = false;

		o = s.option(form.Value, 'at_port', _('AT Serial Port'));
		o.placeholder = '/dev/ttyUSB1';
		o.depends('mode', 'serial');
		o.depends('mode', 'auto');
		o.rmempty = true;

		o = s.option(form.Value, 'host', _('AT Host'));
		o.datatype = 'host';
		o.default = '192.168.8.1';
		o.rmempty = false;

		o = s.option(form.Value, 'port', _('AT Port'));
		o.datatype = 'port';
		o.default = '20249';
		o.rmempty = false;

		o = s.option(form.Value, 'timeout', _('Timeout'));
		o.datatype = 'range(1,60)';
		o.default = '8';
		o.rmempty = false;

		return m.render();
	}
});
