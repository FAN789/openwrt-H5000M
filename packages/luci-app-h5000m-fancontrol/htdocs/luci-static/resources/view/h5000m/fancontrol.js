'use strict';
'require view';
'require form';
'require fs';
'require ui';

return view.extend({
	load: function() {
		return fs.exec('/usr/sbin/h5000m-fancontrol', [ 'status' ]).catch(function() {
			return { stdout: '' };
		});
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

	toNum: function(value, fallback) {
		var n = parseInt(value, 10);

		return isNaN(n) ? fallback : n;
	},

	normalizeTemp: function(value, fallback) {
		var n = this.toNum(value, fallback);

		if (isNaN(n))
			return fallback;

		return Math.abs(n) > 1000 ? Math.round(n / 1000) : n;
	},

	clamp: function(value, min, max) {
		return Math.max(min, Math.min(max, value));
	},

	formatTemp: function(value) {
		return value ? _('%s C').format(value) : _('Unknown');
	},

	formatRpm: function(data) {
		if (data.fan_rpm)
			return _('%s RPM').format(data.fan_rpm);

		if (data.fan_feedback === '0')
			return _('No RPM feedback');

		return _('Unknown');
	},

	statusCard: function(title, value, hint) {
		return E('div', { 'class': 'h5000m-fan-card' }, [
			E('div', { 'class': 'h5000m-fan-card-title' }, title),
			E('div', { 'class': 'h5000m-fan-card-value' }, value),
			hint ? E('div', { 'class': 'h5000m-fan-card-hint' }, hint) : null
		]);
	},

	styleNode: function() {
		return E('style', {}, [
			'.h5000m-fan-status,.h5000m-fan-curve{margin-bottom:16px}',
			'.h5000m-fan-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:12px}',
			'.h5000m-fan-card{border:1px solid var(--border-color-medium,#d8d8d8);border-radius:8px;padding:12px;background:var(--background-color-high,#fff);min-height:76px}',
			'.h5000m-fan-card-title{font-size:12px;color:var(--text-color-medium,#666);margin-bottom:6px}',
			'.h5000m-fan-card-value{font-size:21px;line-height:1.25;font-weight:600;color:var(--text-color-high,#222);word-break:break-word}',
			'.h5000m-fan-card-hint{font-size:11px;color:var(--text-color-low,#888);margin-top:6px;word-break:break-word}',
			'.h5000m-fan-note{margin-top:10px;color:var(--text-color-medium,#666)}',
			'.h5000m-fan-curve-box{border:1px solid var(--border-color-medium,#d8d8d8);border-radius:8px;background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.018));padding:14px;overflow:hidden}',
			'.h5000m-fan-curve-layout{display:grid;grid-template-columns:minmax(320px,1fr) 210px;gap:16px;align-items:stretch}',
			'.h5000m-fan-curve-canvas{width:100%;height:280px;display:block;border-radius:6px;background:#17191c}',
			'.h5000m-fan-curve-side{display:grid;grid-template-columns:1fr;gap:10px}',
			'.h5000m-fan-curve-chip{border:1px solid var(--border-color-low,#30363d);border-radius:8px;padding:10px;background:rgba(255,255,255,.035)}',
			'.h5000m-fan-curve-chip-title{font-size:12px;color:var(--text-color-medium,#777);margin-bottom:4px}',
			'.h5000m-fan-curve-chip-value{font-size:20px;font-weight:600;color:var(--text-color-high,#dce2e8)}',
			'.h5000m-fan-legend{display:flex;flex-wrap:wrap;gap:12px;margin-top:12px;color:var(--text-color-medium,#666);font-size:12px}',
			'.h5000m-fan-swatch{display:inline-block;width:10px;height:10px;border-radius:2px;margin-right:5px;vertical-align:-1px}',
			'@media (max-width: 900px){.h5000m-fan-curve-layout{grid-template-columns:1fr}.h5000m-fan-curve-side{grid-template-columns:repeat(auto-fit,minmax(140px,1fr))}}',
			'.h5000m-fan-slider{display:flex;align-items:center;gap:10px;max-width:460px}',
			'.h5000m-fan-slider input[type="range"]{flex:1;min-width:180px}',
			'.h5000m-fan-slider input[type="number"]{width:82px}'
		].join(''));
	},

	statusPanel: function(data) {
		var pwmHint = data.pwm ? data.pwm.replace('/sys/class/hwmon/', '') : _('PWM node not found');
		var fanHint = data.fan_feedback === '0' ? _('Current driver does not expose fan_input') : (data.fan || '');

		return E('div', { 'class': 'h5000m-fan-status' }, [
			E('h3', _('Current Status')),
			E('div', { 'class': 'h5000m-fan-grid' }, [
				this.statusCard(_('Fan Speed'), this.formatRpm(data), fanHint),
				this.statusCard(_('Current PWM'), data.pwm_value || _('Unknown'), pwmHint),
				this.statusCard(_('Modem Temperature'), this.formatTemp(data.module_temp), _('From QModem cache')),
				this.statusCard(_('CPU Temperature'), this.formatTemp(data.cpu_temp), data.temp1_label || ''),
				this.statusCard(_('WiFi Temperature 1'), this.formatTemp(data.wifi1_temp), data.temp2_label || ''),
				this.statusCard(_('WiFi Temperature 2'), this.formatTemp(data.wifi2_temp), data.temp3_label || '')
			]),
			data.fan_feedback === '0'
				? E('div', { 'class': 'h5000m-fan-note' }, _('The current system only provides PWM control and does not expose a fan speed feedback node.'))
				: null
		]);
	},

	pwmAtTemp: function(temp, low, high, minPwm, maxPwm) {
		if (temp <= low)
			return minPwm;
		if (temp >= high)
			return maxPwm;

		return Math.round(minPwm + (temp - low) * (maxPwm - minPwm) / (high - low));
	},

	drawCurveCanvas: function(canvasId, config) {
		var canvas = document.getElementById(canvasId);
		var ratio, width, height, ctx, left, top, right, bottom, plotW, plotH;
		var tempMin, tempMax, lowX, highX, minY, maxY, manualY, currentX, currentY, gradient;
		var xForTemp, yForPwm;

		if (!canvas)
			return;

		width = canvas.clientWidth || 640;
		height = canvas.clientHeight || 240;
		ratio = window.devicePixelRatio || 1;

		canvas.width = Math.round(width * ratio);
		canvas.height = Math.round(height * ratio);

		ctx = canvas.getContext('2d');
		ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
		ctx.clearRect(0, 0, width, height);

		left = 54;
		top = 22;
		right = 24;
		bottom = 46;
		plotW = width - left - right;
		plotH = height - top - bottom;

		tempMin = Math.max(0, config.low - 15);
		tempMax = Math.min(120, config.high + 15);
		if (tempMax <= tempMin)
			tempMax = tempMin + 1;

		xForTemp = L.bind(function(temp) {
			return left + (this.clamp(temp, tempMin, tempMax) - tempMin) * plotW / (tempMax - tempMin);
		}, this);

		yForPwm = L.bind(function(pwm) {
			return top + (255 - this.clamp(pwm, 0, 255)) * plotH / 255;
		}, this);

		lowX = xForTemp(config.low);
		highX = xForTemp(config.high);
		minY = yForPwm(config.minPwm);
		maxY = yForPwm(config.maxPwm);

		ctx.fillStyle = '#17191c';
		ctx.strokeStyle = '#343941';
		ctx.lineWidth = 1;
		ctx.fillRect(left, top, plotW, plotH);
		ctx.strokeRect(left, top, plotW, plotH);

		ctx.strokeStyle = 'rgba(255,255,255,.07)';
		ctx.beginPath();
		for (var i = 1; i < 4; i++) {
			ctx.moveTo(left, top + plotH * i / 4);
			ctx.lineTo(left + plotW, top + plotH * i / 4);
			ctx.moveTo(left + plotW * i / 4, top);
			ctx.lineTo(left + plotW * i / 4, top + plotH);
		}
		ctx.stroke();

		ctx.strokeStyle = 'rgba(255,255,255,.18)';
		ctx.setLineDash([4, 4]);
		ctx.beginPath();
		ctx.moveTo(lowX, top);
		ctx.lineTo(lowX, top + plotH);
		ctx.moveTo(highX, top);
		ctx.lineTo(highX, top + plotH);
		ctx.stroke();
		ctx.setLineDash([]);

		gradient = ctx.createLinearGradient(0, top, 0, top + plotH);
		gradient.addColorStop(0, 'rgba(69,183,125,.34)');
		gradient.addColorStop(1, 'rgba(69,183,125,.02)');

		ctx.fillStyle = gradient;
		ctx.beginPath();
		ctx.moveTo(left, top + plotH);
		ctx.lineTo(left, minY);
		ctx.lineTo(lowX, minY);
		ctx.lineTo(highX, maxY);
		ctx.lineTo(left + plotW, maxY);
		ctx.lineTo(left + plotW, top + plotH);
		ctx.closePath();
		ctx.fill();

		ctx.strokeStyle = '#45b77d';
		ctx.lineWidth = 3;
		ctx.lineCap = 'round';
		ctx.lineJoin = 'round';
		ctx.beginPath();
		ctx.moveTo(left, minY);
		ctx.lineTo(lowX, minY);
		ctx.lineTo(highX, maxY);
		ctx.lineTo(left + plotW, maxY);
		ctx.stroke();

		if (config.mode === 'manual') {
			manualY = yForPwm(config.manualPwm);
			ctx.strokeStyle = '#79b8ff';
			ctx.lineWidth = 2;
			ctx.setLineDash([6, 4]);
			ctx.beginPath();
			ctx.moveTo(left, manualY);
			ctx.lineTo(left + plotW, manualY);
			ctx.stroke();
			ctx.setLineDash([]);
		}

		if (!isNaN(config.currentTemp)) {
			if (isNaN(config.currentPwm))
				config.currentPwm = config.mode === 'manual'
					? config.manualPwm
					: this.pwmAtTemp(config.currentTemp, config.low, config.high, config.minPwm, config.maxPwm);

			currentX = xForTemp(config.currentTemp);
			currentY = yForPwm(config.currentPwm);
			ctx.fillStyle = '#ff5d5d';
			ctx.strokeStyle = 'rgba(255,255,255,.8)';
			ctx.lineWidth = 2;
			ctx.beginPath();
			ctx.arc(currentX, currentY, 5, 0, Math.PI * 2);
			ctx.fill();
			ctx.stroke();
		}

		ctx.fillStyle = 'rgba(255,255,255,.62)';
		ctx.font = '12px sans-serif';
		ctx.textBaseline = 'middle';
		ctx.fillText('255', 18, top);
		ctx.fillText('0', 28, top + plotH);
		ctx.fillText('PWM', left + plotW - 30, top + 12);
		ctx.textBaseline = 'top';
		ctx.fillText(tempMin + ' C', left, top + plotH + 12);
		ctx.fillText(config.low + ' C', lowX - 18, top + plotH + 12);
		ctx.fillText(config.high + ' C', highX - 18, top + plotH + 12);
		ctx.fillText(tempMax + ' C', left + plotW - 42, top + plotH + 12);
		ctx.fillText(_('Temperature'), left + plotW - 78, top + plotH + 28);
	},

	curvePanel: function(data) {
		var mode = data.mode || 'auto';
		var low = this.toNum(data.low_temp, 45);
		var high = this.toNum(data.high_temp, 70);
		var minPwm = this.toNum(data.min_pwm, 80);
		var maxPwm = this.toNum(data.max_pwm, 255);
		var manualPwm = this.toNum(data.manual_pwm, 160);
		var currentTemp = this.normalizeTemp(data.cpu_temp || data.temp_value, NaN);
		var currentPwm = this.toNum(data.pwm_value, NaN);
		var modeText, canvasId, self, canvasConfig, legendItems;

		low = this.clamp(low, 0, 120);
		high = this.clamp(high, 1, 120);
		minPwm = this.clamp(minPwm, 0, 255);
		maxPwm = this.clamp(maxPwm, 0, 255);
		manualPwm = this.clamp(manualPwm, 0, 255);

		if (high <= low)
			high = low + 1;

		if (mode === 'manual')
			modeText = _('Manual mode: the slider value is used as a fixed PWM output.');
		else if (mode === 'off')
			modeText = _('Off mode: fan PWM output is set to 0.');
		else
			modeText = _('Auto mode: low temperatures use the minimum PWM, high temperatures use the maximum PWM, and values in between increase linearly.');

		canvasId = 'h5000m-fan-curve-canvas';
		self = this;
		canvasConfig = {
			mode: mode,
			low: low,
			high: high,
			minPwm: minPwm,
			maxPwm: maxPwm,
			manualPwm: manualPwm,
			currentTemp: currentTemp,
			currentPwm: currentPwm
		};

		window.h5000mFanCurveDraw = function(nextManualPwm) {
			if (typeof nextManualPwm === 'number') {
				canvasConfig.mode = 'manual';
				canvasConfig.manualPwm = nextManualPwm;
				canvasConfig.currentPwm = nextManualPwm;
			}
			self.drawCurveCanvas(canvasId, canvasConfig);
		};

		window.setTimeout(function() {
			window.h5000mFanCurveDraw();
		}, 0);

		legendItems = [
			E('span', [ E('span', { 'class': 'h5000m-fan-swatch', style: 'background:#45b77d' }), _('Auto Curve') ])
		];

		if (mode === 'manual')
			legendItems.push(E('span', [ E('span', { 'class': 'h5000m-fan-swatch', style: 'background:#79b8ff' }), _('Manual PWM') ]));

		if (!isNaN(currentTemp))
			legendItems.push(E('span', [ E('span', { 'class': 'h5000m-fan-swatch', style: 'background:#ff5d5d' }), _('Current Status') ]));

		return E('div', { 'class': 'h5000m-fan-curve' }, [
			E('h3', _('Fan Curve')),
			E('div', { 'class': 'h5000m-fan-curve-box' }, [
				E('div', { 'class': 'h5000m-fan-curve-layout' }, [
					E('canvas', { id: canvasId, 'class': 'h5000m-fan-curve-canvas', width: '720', height: '280' }),
					E('div', { 'class': 'h5000m-fan-curve-side' }, [
						E('div', { 'class': 'h5000m-fan-curve-chip' }, [
							E('div', { 'class': 'h5000m-fan-curve-chip-title' }, _('Temperature Range')),
							E('div', { 'class': 'h5000m-fan-curve-chip-value' }, low + ' - ' + high + ' C')
						]),
						E('div', { 'class': 'h5000m-fan-curve-chip' }, [
							E('div', { 'class': 'h5000m-fan-curve-chip-title' }, _('PWM Range')),
							E('div', { 'class': 'h5000m-fan-curve-chip-value' }, minPwm + ' - ' + maxPwm)
						]),
						E('div', { 'class': 'h5000m-fan-curve-chip' }, [
							E('div', { 'class': 'h5000m-fan-curve-chip-title' }, _('Current PWM')),
							E('div', { 'class': 'h5000m-fan-curve-chip-value' }, isNaN(currentPwm) ? '-' : currentPwm)
						])
					])
				]),
				E('div', { 'class': 'h5000m-fan-legend' }, legendItems),
				E('div', { 'class': 'h5000m-fan-note' }, modeText)
			])
		]);
	},

	renderManualPwmWidget: function(option) {
		option.renderWidget = function(section_id, option_index, cfgvalue) {
			var value = cfgvalue || this.default || '160';
			var inputId = this.cbid(section_id);
			var rangeId = inputId + '-range';
			var numberId = inputId + '-number';
			var updateCurve = function(next) {
				var pwm = Math.max(0, Math.min(255, parseInt(next, 10) || 0));

				if (window.h5000mFanCurveDraw)
					window.h5000mFanCurveDraw(pwm);
			};

			return E('div', { 'class': 'h5000m-fan-slider' }, [
				E('input', {
					id: rangeId,
					type: 'range',
					min: '0',
					max: '255',
					step: '1',
					value: value,
					oninput: function(ev) {
						var text = document.getElementById(inputId);
						var number = document.getElementById(numberId);

						if (text)
							text.value = ev.target.value;
						if (number)
							number.value = ev.target.value;
						updateCurve(ev.target.value);
					}
				}),
				E('input', {
					id: numberId,
					type: 'number',
					min: '0',
					max: '255',
					step: '1',
					value: value,
					oninput: function(ev) {
						var range = document.getElementById(rangeId);
						var text = document.getElementById(inputId);

						if (range)
							range.value = ev.target.value;
						if (text)
							text.value = ev.target.value;
						updateCurve(ev.target.value);
					}
				}),
				E('input', {
					id: inputId,
					name: inputId,
					type: 'hidden',
					value: value
				})
			]);
		};
	},

	render: function(res) {
		var m, s, o;
		var status = this.parseStatus(res);

		m = new form.Map('h5000m_fancontrol', _('Fan Control'));
		m.description = _('Adjust the PWM fan policy.');

		s = m.section(form.NamedSection, 'settings', 'settings');
		s.anonymous = true;

		o = s.option(form.Flag, 'enabled', _('Enable'));
		o.default = '1';
		o.rmempty = false;

		o = s.option(form.ListValue, 'mode', _('Mode'));
		o.value('auto', _('Auto'));
		o.value('manual', _('Manual'));
		o.value('off', _('Off'));
		o.default = 'auto';
		o.rmempty = false;

		o = s.option(form.Value, 'manual_pwm', _('Manual PWM'));
		o.datatype = 'range(0,255)';
		o.default = '160';
		this.renderManualPwmWidget(o);

		o = s.option(form.Value, 'min_pwm', _('Minimum PWM'));
		o.datatype = 'range(0,255)';
		o.default = '80';

		o = s.option(form.Value, 'max_pwm', _('Maximum PWM'));
		o.datatype = 'range(0,255)';
		o.default = '255';

		o = s.option(form.Value, 'low_temp', _('Low Temperature Threshold'));
		o.datatype = 'range(0,120)';
		o.default = '45';

		o = s.option(form.Value, 'high_temp', _('High Temperature Threshold'));
		o.datatype = 'range(1,120)';
		o.default = '70';

		o = s.option(form.Value, 'interval', _('Refresh Interval'));
		o.datatype = 'range(5,300)';
		o.default = '15';

		m.handleSaveApply = function(ev, mode) {
			return form.Map.prototype.handleSaveApply.apply(this, [ ev, mode ]).then(function() {
				return fs.exec('/usr/sbin/h5000m-fancontrol', [ 'apply' ]).then(function() {
					return fs.exec('/etc/init.d/h5000m-fancontrol', [ 'restart' ]);
				}).then(function() {
					ui.addNotification(null, E('p', _('Fan control has been applied.')));
				}, function(err) {
					ui.addNotification(null, E('p', _('Failed to apply fan control:') + ' ' + err.message), 'danger');
				});
			});
		};

		return m.render().then(L.bind(function(node) {
			return E('div', {}, [
				this.styleNode(),
				this.statusPanel(status),
				this.curvePanel(status),
				node
			]);
		}, this));
	}
});
