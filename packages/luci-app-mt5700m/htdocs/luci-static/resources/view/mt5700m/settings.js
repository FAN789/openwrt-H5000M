'use strict';
'require view';
'require form';

return view.extend({
	render: function() {
		var m, s, o;

		m = new form.Map('mt5700m', _('MT5700M Management'));
		m.description = _('Configure the MT5700M module network AT endpoint used by the native LuCI pages.');

		s = m.section(form.NamedSection, 'settings', 'mt5700m');
		s.anonymous = true;

		o = s.option(form.Flag, 'enabled', _('Enable'));
		o.default = '1';
		o.rmempty = false;

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
