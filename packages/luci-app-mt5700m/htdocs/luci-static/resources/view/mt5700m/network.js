'use strict';
'require view';
'require fs';
'require ui';

function sectionValue(raw, label) {
	var marker = '===== ' + label + ':';
	var lines = (raw || '').split(/\n/);
	var active = false;
	var result = [];

	lines.forEach(function(line) {
		if (line.indexOf('===== ') === 0) {
			active = line.indexOf(marker) === 0;
			return;
		}
		if (active && line.trim() && line.trim() !== 'OK')
			result.push(line.trim());
	});

	return result.join('\n');
}

function matchValues(text, prefix) {
	var line = (text || '').split(/\n/).filter(function(item) { return item.indexOf(prefix) === 0; })[0] || '';
	return line.substring(prefix.length).replace(/^[ :]+/, '').replace(/"/g, '').split(',').map(function(value) { return value.trim(); });
}

function cleanCsv(value) {
	return (value || '').replace(/\s+/g, '').replace(/^,+|,+$/g, '').replace(/,+/g, ',');
}

function validCsv(value) {
	return /^[0-9]+(,[0-9]+)*$/.test(value);
}

return view.extend({
	load: function() {
		return fs.exec('/usr/sbin/mt5700m-at', [ 'network' ]).catch(function(err) {
			return { stdout: '', stderr: err.message || String(err) };
		});
	},

	styleNode: function() {
		return E('style', {}, [
			'.mt-net{max-width:1120px;margin:0 auto;color:var(--text-color-high,#20242a)}',
			'.mt-net-hero{display:flex;justify-content:space-between;align-items:center;gap:18px;padding:21px 23px;border:1px solid #cfe4fb;border-radius:15px;background:linear-gradient(135deg,#f4f9ff,#eefaf8);margin-bottom:16px}',
			'.mt-net-kicker{font-size:12px;color:#2470a9;font-weight:700;margin-bottom:5px}',
			'.mt-net-title{font-size:25px;font-weight:720;line-height:1.2;margin:0 0 6px}',
			'.mt-net-sub{font-size:13px;color:var(--text-color-medium,#68717d)}',
			'.mt-net-badge{display:inline-flex;align-items:center;gap:7px;padding:7px 11px;border-radius:999px;background:#dcf6eb;color:#08775d;font-size:12px;font-weight:700;white-space:nowrap}',
			'.mt-net-badge:before{content:"";width:7px;height:7px;border-radius:50%;background:#17b883}',
			'.mt-net-badge.off{background:#fff0e2;color:#99530a}.mt-net-badge.off:before{background:#e99737}',
			'.mt-net-metrics{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:12px;margin:0 0 16px}',
			'.mt-net-metric,.mt-net-panel{border:1px solid var(--border-color-medium,#d9dde4);border-radius:13px;background:var(--background-color-high,#fff);box-shadow:0 3px 12px rgba(20,32,50,.04)}',
			'.mt-net-metric{padding:16px}.mt-net-label{font-size:12px;color:var(--text-color-medium,#707985);margin-bottom:6px}',
			'.mt-net-value{font-size:23px;font-weight:720}.mt-net-unit{font-size:12px;color:#747c86;margin-left:5px}',
			'.mt-net-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}',
			'.mt-net-panel{padding:16px}.mt-net-panel h3{font-size:14px;margin:0 0 12px}',
			'.mt-net-row{display:flex;justify-content:space-between;gap:16px;padding:9px 0;border-bottom:1px solid var(--border-color-low,#edf0f4);font-size:13px}',
			'.mt-net-row:last-child{border-bottom:0}.mt-net-row span:first-child{color:var(--text-color-medium,#707985)}.mt-net-row strong{text-align:right;word-break:break-word}',
			'.mt-net-actions{display:flex;gap:9px;flex-wrap:wrap;margin-top:15px}.mt-net-actions .btn{border-radius:9px;padding:7px 14px}',
			'.mt-net-details{margin-top:14px;border:1px solid var(--border-color-medium,#d9dde4);border-radius:12px;overflow:hidden}',
			'.mt-net-details summary{cursor:pointer;padding:13px 15px;font-size:13px;font-weight:650}.mt-net-raw{margin:0;padding:14px;background:#17202a;color:#dce6ef;white-space:pre-wrap;word-break:break-word;font:12px/1.55 monospace;max-height:420px;overflow:auto}',
			'.mt-freq-head{margin-top:20px;padding:19px 20px;border-radius:13px;background:linear-gradient(135deg,#f4f7fb,#f1f8f6);border:1px solid #dce7ee}.mt-freq-head h3{font-size:18px;margin:0 0 6px}.mt-freq-head p{margin:0;color:var(--text-color-medium,#68717d);font-size:12px}',
			'.mt-freq-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px;margin-top:12px}.mt-freq-card{padding:17px;border:1px solid var(--border-color-medium,#d9dde4);border-radius:13px;background:var(--background-color-high,#fff)}.mt-freq-card h4{margin:0 0 12px;font-size:14px}.mt-freq-field{margin:11px 0}.mt-freq-field label{display:block;font-size:12px;color:var(--text-color-medium,#6d7680);margin-bottom:5px}.mt-freq-field input,.mt-freq-field select{width:100%;box-sizing:border-box}.mt-freq-help{font-size:11px;color:var(--text-color-medium,#7b838c);margin-top:5px}.mt-freq-actions{display:flex;justify-content:flex-end;margin-top:14px}',
			'@media(max-width:720px){.mt-net-hero{display:block}.mt-net-badge{margin-top:13px}.mt-net-metrics{grid-template-columns:1fr}.mt-net-grid,.mt-freq-grid{grid-template-columns:1fr}}'
		].join(''));
	},

	row: function(label, value) {
		return E('div', { 'class': 'mt-net-row' }, [ E('span', {}, label), E('strong', {}, value || '--') ]);
	},

	metric: function(label, value, unit) {
		return E('div', { 'class': 'mt-net-metric' }, [
			E('div', { 'class': 'mt-net-label' }, label),
			E('span', { 'class': 'mt-net-value' }, value || '--'),
			value ? E('span', { 'class': 'mt-net-unit' }, unit) : null
		]);
	},

	lockPanel: function(title, rat) {
		var self = this;
		var type = E('select', { 'class':'cbi-input-select' }, [E('option',{'value':'3'},_('Band Lock')),E('option',{'value':'1'},_('ARFCN Lock')),E('option',{'value':'2'},_('Cell Lock')),E('option',{'value':'0'},_('Remove Lock'))]);
		var bands = E('input', { 'class':'cbi-input-text','placeholder':rat==='nr'?'78,41':'3,8','inputmode':'numeric' });
		var arfcns = E('input', { 'class':'cbi-input-text','placeholder':rat==='nr'?'630000,520000':'1850,3450','inputmode':'numeric' });
		var scs = E('input', { 'class':'cbi-input-text','placeholder':'1,1','inputmode':'numeric' });
		var pcis = E('input', { 'class':'cbi-input-text','placeholder':'100,200','inputmode':'numeric' });
		var wraps = {};
		function field(key,label,input,help){wraps[key]=E('div',{'class':'mt-freq-field'},[E('label',{},label),input,E('div',{'class':'mt-freq-help'},help)]);return wraps[key];}
		function update(){var t=type.value;wraps.bands.style.display=t==='0'?'none':'';wraps.arfcns.style.display=t==='1'||t==='2'?'':'none';if(wraps.scs)wraps.scs.style.display=t==='1'||t==='2'?'':'none';wraps.pcis.style.display=t==='2'?'':'none';}
		function apply(){
			var t=type.value, values=[cleanCsv(bands.value),cleanCsv(arfcns.value),cleanCsv(scs.value),cleanCsv(pcis.value)];
			var required=t==='0'?[]:t==='3'?[0]:t==='1'?(rat==='nr'?[0,1,2]:[0,1]):(rat==='nr'?[0,1,2,3]:[0,1,3]);
			if(required.some(function(i){return !validCsv(values[i]);}))return ui.addNotification(null,E('p',{},_('Complete all required fields using comma-separated numbers.')),'warning');
			var lengths=required.map(function(i){return values[i].split(',').length;});
			if(lengths.some(function(n){return n!==lengths[0];}))return ui.addNotification(null,E('p',{},_('Each field must contain the same number of values.')),'warning');
			var args=rat==='nr'?['lock',rat,t,values[0],values[1],values[2],values[3]]:['lock',rat,t,values[0],values[1],values[3]];
			ui.showModal(_('Confirm frequency change'),[E('p',{},t==='0'?_('Remove the current %s frequency lock?').format(rat.toUpperCase()):_('Apply this %s frequency lock? Mobile connectivity may reconnect.').format(rat.toUpperCase())),E('div',{'class':'right'},[E('button',{'type':'button','class':'btn','click':ui.hideModal},_('Cancel')),' ',E('button',{'type':'button','class':'btn cbi-button-negative','click':function(){ui.hideModal();fs.exec('/usr/sbin/mt5700m-at',args).then(function(){ui.addNotification(null,E('p',{},_('Frequency lock updated.')));window.setTimeout(function(){window.location.reload();},900);},function(err){ui.addNotification(null,E('p',{},err.message||_('The modem rejected this setting.')),'danger');});}},t==='0'?_('Remove Lock'):_('Apply Lock'))])]);
		}
		type.addEventListener('change',update);
		var body=[field('type',_('Lock Type'),type,_('Choose the least restrictive mode that meets your need.')),field('bands',_('Bands'),bands,_('Use numbers separated by commas.')),field('arfcns',_('ARFCNs'),arfcns,_('One ARFCN for each band.'))];
		if(rat==='nr')body.push(field('scs',_('SCS Types'),scs,_('One SCS type for each NR band.')));
		body.push(field('pcis','PCI',pcis,_('One PCI for each band and ARFCN.')),E('div',{'class':'mt-freq-actions'},E('button',{'type':'button','class':'btn cbi-button-apply','click':apply},_('Review and apply'))));
		var card=E('section',{'class':'mt-freq-card'},[E('h4',{},title)].concat(body));window.setTimeout(update,0);return card;
	},

	render: function(res) {
		var raw = res.stdout || '';
		var signal = matchValues(sectionValue(raw, 'Signal'), '^HCSQ');
		var cell = matchValues(sectionValue(raw, 'Serving cell'), '^MONSC');
		var registration = matchValues(sectionValue(raw, 'Network registration'), '+CEREG');
		var operator = matchValues(sectionValue(raw, 'Operator'), '+COPS');
		var lteLock = matchValues(sectionValue(raw, 'LTE lock'), '^LTEFREQLOCK');
		var nrLock = matchValues(sectionValue(raw, 'NR lock'), '^NRFREQLOCK');
		var registered = registration[1] === '1' || registration[1] === '5';
		var operatorName = operator[2] || _('Mobile Network');
		var rsrp = cell.length >= 3 ? cell[cell.length - 3] : '';
		var rsrq = cell.length >= 2 ? cell[cell.length - 2] : '';
		var sinr = cell.length >= 1 ? cell[cell.length - 1] : '';
		var self = this;

		return E('div', { 'class': 'mt-net' }, [
			this.styleNode(),
			res.stderr ? E('div', { 'class': 'alert-message warning' }, res.stderr) : null,
			E('section', { 'class': 'mt-net-hero' }, [
				E('div', {}, [
					E('div', { 'class': 'mt-net-kicker' }, _('NETWORK AND CELL')),
					E('h2', { 'class': 'mt-net-title' }, operatorName),
					E('div', { 'class': 'mt-net-sub' }, _('Serving-cell and registration information reported by the modem.'))
				]),
				E('span', { 'class': 'mt-net-badge' + (registered ? '' : ' off') }, registered ? _('Registered') : _('Not registered'))
			]),
			E('div', { 'class': 'mt-net-metrics' }, [
				this.metric('RSRP', rsrp, 'dBm'),
				this.metric('RSRQ', rsrq, 'dB'),
				this.metric('SINR', sinr, 'dB')
			]),
			E('div', { 'class': 'mt-net-grid' }, [
				E('section', { 'class': 'mt-net-panel' }, [
					E('h3', {}, _('Serving cell')),
					this.row(_('Radio access'), cell[0] || signal[0]),
					this.row('MCC / MNC', cell.length > 2 ? '%s / %s'.format(cell[1], cell[2]) : ''),
					this.row(_('Registration'), registered ? (registration[1] === '5' ? _('Roaming') : _('Home network')) : _('Not registered'))
				]),
				E('section', { 'class': 'mt-net-panel' }, [
					E('h3', {}, _('Frequency lock')),
					this.row(_('LTE Lock'), lteLock[0] === '0' ? _('Not locked') : _('Locked')),
					this.row(_('NR Lock'), nrLock[0] === '0' ? _('Not locked') : _('Locked')),
					this.row(_('Operator'), operatorName)
				])
			]),
			E('div', { 'class': 'mt-net-actions' }, [
				E('button', { 'class': 'btn cbi-button-action', 'click': function() { window.location.reload(); } }, _('Refresh status')),
				E('button', { 'class': 'btn cbi-button', 'click': function() {
					return ui.showModal(_('Confirm Action'), [
						E('p', {}, _('Cell scan may take some time and can briefly increase modem load.')),
						E('div', { 'class': 'right' }, [ E('button', { 'class': 'btn', 'click': ui.hideModal }, _('Cancel')), ' ', E('button', { 'class': 'btn cbi-button-apply', 'click': function() {
							ui.hideModal();
							fs.exec('/usr/sbin/mt5700m-at', [ 'cellscan' ]).then(function(scan) { ui.showModal(_('Cell Scan'), [ E('pre', { 'class': 'mt-net-raw' }, scan.stdout || _('No response.')), E('div', { 'class': 'right' }, E('button', { 'class': 'btn', 'click': ui.hideModal }, _('Close'))) ]); });
						} }, _('Continue')) ])
					]);
				} }, _('Cell Scan'))
			]),
			E('details', { 'class': 'mt-net-details' }, [ E('summary', {}, _('Technical details')), E('pre', { 'class': 'mt-net-raw' }, raw || _('No response.')) ])
			,E('section', { 'class':'mt-freq-head' }, [E('h3',{},_('Frequency and cell selection')),E('p',{},_('Advanced controls for limiting LTE or 5G NR bands, frequencies and cells. Leave these unlocked for normal automatic network selection.'))]),
			E('div', { 'class':'mt-freq-grid' }, [this.lockPanel(_('LTE network'),'lte'),this.lockPanel(_('5G NR network'),'nr')])
		]);
	},

	handleSave: null,
	handleSaveApply: null,
	handleReset: null
});
