(function () {
	/* Google Reviews: 4-line clamp with expand (linkable mode only) + auto-advancing carousel */
	function initReviews() {
		document.querySelectorAll('.rev-carousel').forEach(function (carousel) {
			var linkable = carousel.getAttribute('data-linkable') === '1';
			var track = carousel.querySelector('.rev-track');
			var cards = Array.prototype.slice.call(carousel.querySelectorAll('.rev-card'));
			if (!track || !cards.length) return;

			// "Read more" only where the text actually overflows the 4-line clamp.
			if (linkable) {
				cards.forEach(function (card) {
					var text = card.querySelector('.rev-text');
					if (!text || text.scrollHeight <= text.clientHeight + 2) return;
					var btn = document.createElement('button');
					btn.type = 'button';
					btn.className = 'rev-more';
					btn.textContent = 'Read more';
					btn.addEventListener('click', function () {
						var open = text.classList.toggle('expanded');
						btn.textContent = open ? 'Read less' : 'Read more';
					});
					text.after(btn);
				});
			}

			// Dots + auto-advance (pause on hover/touch).
			var dotsWrap = carousel.querySelector('.rev-dots');
			var dots = [];
			if (dotsWrap) {
				cards.forEach(function (_, i) {
					var d = document.createElement('button');
					d.setAttribute('aria-label', 'Review ' + (i + 1));
					d.addEventListener('click', function () { go(i); });
					dotsWrap.appendChild(d);
					dots.push(d);
				});
			}
			var idx = 0;
			function markActive() {
				var pos = track.scrollLeft;
				var w = cards[0].offsetWidth + 22;
				idx = Math.round(pos / w);
				dots.forEach(function (d, i) { d.classList.toggle('active', i === idx); });
			}
			function go(i) {
				var w = cards[0].offsetWidth + 22;
				var max = track.scrollWidth - track.clientWidth;
				track.scrollTo({ left: Math.min(i * w, max), behavior: 'smooth' });
			}
			track.addEventListener('scroll', function () { window.requestAnimationFrame(markActive); });
			markActive();

			var paused = false;
			carousel.addEventListener('mouseenter', function () { paused = true; });
			carousel.addEventListener('mouseleave', function () { paused = false; });
			carousel.addEventListener('touchstart', function () { paused = true; }, { passive: true });
			setInterval(function () {
				if (paused || document.hidden) return;
				var w = cards[0].offsetWidth + 22;
				var max = track.scrollWidth - track.clientWidth;
				var next = (track.scrollLeft >= max - 4) ? 0 : Math.min((idx + 1) * w, max);
				track.scrollTo({ left: next, behavior: 'smooth' });
			}, 5000);
		});
	}
	if (document.readyState === 'loading') {
		document.addEventListener('DOMContentLoaded', initReviews);
	} else {
		initReviews();
	}

	var toggle = document.getElementById('ibcNavToggle');
	var nav = document.getElementById('ibcNav');
	if (toggle && nav) {
		toggle.addEventListener('click', function () {
			var open = nav.classList.toggle('open');
			toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
		});
		nav.addEventListener('click', function (e) {
			if (e.target.tagName === 'A') {
				nav.classList.remove('open');
			}
		});
	}
})();

/* Limited-time quarterly offer popup */
(function () {
	var modal = document.getElementById('ibcOfferModal');
	if (!modal) return;
	var KEY = 'ibc_offer_seen';
	function open() { modal.hidden = false; document.body.style.overflow = 'hidden'; }
	function close() {
		modal.hidden = true;
		document.body.style.overflow = '';
		try { localStorage.setItem(KEY, '1'); } catch (e) {}
	}
	modal.addEventListener('click', function (e) {
		if (e.target.hasAttribute && e.target.hasAttribute('data-close')) close();
	});
	document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !modal.hidden) close(); });
	document.addEventListener('click', function (e) {
		var btn = e.target.closest && e.target.closest('.js-open-offer');
		if (btn) { e.preventDefault(); open(); }
	});
	var seen = false;
	try { seen = localStorage.getItem(KEY) === '1'; } catch (e) {}
	if (!seen) setTimeout(open, 2600);

	var form = modal.querySelector('.ibc-offer-form');
	form.addEventListener('submit', function (e) {
		e.preventDefault();
		var email = form.querySelector('input[type=email]').value.trim();
		var err = modal.querySelector('.ibc-offer-err');
		if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { err.hidden = false; return; }
		err.hidden = true;
		function reveal() {
			modal.querySelector('[data-step=form]').hidden = true;
			modal.querySelector('[data-step=done]').hidden = false;
			try { localStorage.setItem(KEY, '1'); } catch (e) {}
		}
		var endpoint = modal.getAttribute('data-endpoint');
		if (!endpoint) { reveal(); return; } /* static preview: demo mode */
		var data = new FormData();
		data.append('action', 'ibc_offer');
		data.append('email', email);
		data.append('page', window.location.href);
		data.append('ibc_website', form.querySelector('[name=ibc_website]') ? form.querySelector('[name=ibc_website]').value : '');
		fetch(endpoint, { method: 'POST', body: data })
			.then(function (r) { return r.json(); })
			.then(function (j) { if (j && j.ok) { reveal(); } else { err.textContent = 'Please enter a valid email address.'; err.hidden = false; } })
			.catch(function () { reveal(); }); /* never strand the visitor: show the code even if the save failed */
	});
})();

/* Corner chat widget — guided question flow that routes to the right service */
(function () {
	var root = document.getElementById('ibcChat');
	if (!root) return;
	var bubble = root.querySelector('.ibc-chat-bubble');
	var panel = root.querySelector('.ibc-chat-panel');
	var body = root.querySelector('.ibc-chat-body');
	var chipsWrap = root.querySelector('.ibc-chat-chips');
	var d = function (k) { return root.getAttribute('data-' + k) || ''; };
	var endpoint = d('endpoint');
	var areas = d('areas').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
	var P = {
		month: parseInt(d('price-month'), 10) || 30,
		quart: parseInt(d('price-quart'), 10) || 45,
		once: parseInt(d('price-once'), 10) || 65,
		regQuart: parseInt(d('regular-quart'), 10) || 60,
		regOnce: parseInt(d('regular-once'), 10) || 75
	};
	var CHECKOUT = { month: d('checkout-month'), quart: d('checkout-quart'), once: d('checkout-once') };
	var answers = {};
	var started = false;

	function el(tag, cls, html) {
		var n = document.createElement(tag);
		if (cls) n.className = cls;
		if (html !== undefined) n.innerHTML = html;
		return n;
	}
	function scrollDown() { body.scrollTop = body.scrollHeight; }
	function userSay(text) { body.appendChild(el('div', 'ibc-msg user', text)); scrollDown(); }
	function setChips(list) {
		chipsWrap.innerHTML = '';
		(list || []).forEach(function (c) {
			var b = el('button', 'ibc-chip', c.label);
			b.type = 'button';
			b.addEventListener('click', function () { c.run(); });
			chipsWrap.appendChild(b);
		});
	}
	function botSay(html, after) {
		var t = el('div', 'ibc-typing', '<i></i><i></i><i></i>');
		body.appendChild(t);
		scrollDown();
		setTimeout(function () {
			t.remove();
			body.appendChild(el('div', 'ibc-msg bot', html));
			scrollDown();
			if (after) after();
		}, 480);
	}
	function ask(html, chips) { botSay(html, function () { setChips(chips); }); setChips([]); }
	function pick(label, next) { return { label: label, run: function () { userSay(label.replace(/^[^\w$]+\s*/, '')); next(); } }; }

	/* ---------- steps ---------- */
	function stepStart() {
		answers = {};
		ask('👋 Hi there! Answer a couple of quick questions and I’ll point you to the right service. What can we help with?', [
			pick('🗑️ Bin cleaning', function () { answers.service = 'Bin cleaning'; stepFreq(); }),
			pick('💦 Pressure washing', function () { answers.service = 'Pressure washing'; stepPw(); }),
			pick('💬 Something else', function () { answers.service = 'Other'; stepMessage('Sure — tell us what you need and we’ll text you back shortly. 👇'); })
		]);
	}

	function stepFreq() {
		ask('How often would you like your bins cleaned?', [
			pick('Every month', function () { answers.plan = 'month'; stepBins(); }),
			pick('Every 3 months', function () { answers.plan = 'quart'; stepBins(); }),
			pick('Just once — trying it out', function () { answers.plan = 'once'; stepBins(); }),
			pick('🤔 Not sure yet', function () {
				answers.plan = 'quart';
				botSay('No problem! Most of our customers pick the <b>Quarterly Clean</b> — fresh bins every 3 months without overdoing it. Let’s price that out (you can always switch).', stepBins);
			})
		]);
	}

	function stepBins() {
		ask('How many bins should we clean? (trash, recycling, yard debris…)', [
			pick('2 bins', function () { answers.bins = 2; stepCity(); }),
			pick('3 bins', function () { answers.bins = 3; stepCity(); }),
			pick('4 bins', function () { answers.bins = 4; stepCity(); }),
			pick('Just 1', function () { answers.bins = 1; stepCity(); })
		]);
	}

	function stepCity() {
		var chips = areas.slice(0, 5).map(function (a) {
			return pick(a, function () { answers.city = a; stepQuote(true); });
		});
		chips.push(pick('Another city…', function () { answers.city = ''; stepQuote(false); }));
		ask('Which city are you in?', chips);
	}

	function planName(p) { return p === 'month' ? 'Monthly Clean' : p === 'quart' ? 'Quarterly Clean' : 'On-Demand Clean'; }
	function planPer(p) { return p === 'month' ? 'every 4 weeks' : p === 'quart' ? 'every 12 weeks' : 'one time'; }

	function stepQuote(inArea) {
		var p = answers.plan;
		var base = P[p === 'month' ? 'month' : p === 'quart' ? 'quart' : 'once'];
		var extra = Math.max(0, (answers.bins || 2) - 2) * 10;
		var total = base + extra;
		var strike = p === 'quart' ? '$' + P.regQuart : p === 'once' ? '$' + P.regOnce : '';
		var deal = strike ? ' <s style="color:#c0392b">' + strike + '</s>' : '';
		var quote = '<b>' + planName(p) + '</b> · ' + (answers.bins || 2) + ' bin' + ((answers.bins || 2) > 1 ? 's' : '') +
			'<br><span style="font-size:1.3em;font-weight:800">' + deal + ' $' + total + '</span> ' + planPer(p) +
			(extra ? '<br><span style="font-size:.85em;color:#54677a">($' + base + ' + $' + extra + ' for ' + ((answers.bins) - 2) + ' extra bin' + (answers.bins - 2 > 1 ? 's' : '') + ')</span>' : '') +
			(p === 'quart' ? '<br><span style="font-size:.85em;color:#54677a">🎉 Limited-time price — use the offer code from the site popup at checkout.</span>' : '');

		if (inArea) {
			botSay('🎉 Great news — <b>' + answers.city + '</b> is in our service area!', function () {
				botSay('Here’s your quote:<br><br>' + quote + '<br><a class="btn btn-primary" href="' + CHECKOUT[p] + '" target="_blank" rel="noopener">Book ' + planName(p) + ' →</a>', function () {
					setChips([
						pick('✉️ Text me instead', function () { stepMessage('Sure! Leave your info and we’ll text you to get you set up. 👇'); }),
						pick('🔄 Start over', stepStart)
					]);
				});
			});
		} else {
			botSay('We might still be able to reach you — we add routes as neighborhoods fill up. Here’s the quote either way:<br><br>' + quote, function () {
				stepMessage('Leave your name, number, and city — we’ll text you to confirm whether we can service your address. 👇');
			});
		}
	}

	function stepPw() {
		ask('What needs washing?', [
			pick('Driveway / walkway', function () { answers.surface = 'Driveway/walkway'; stepPwCapture(); }),
			pick('Deck or patio', function () { answers.surface = 'Deck/patio'; stepPwCapture(); }),
			pick('House / siding', function () { answers.surface = 'House/siding'; stepPwCapture(); }),
			pick('Fence / retaining wall', function () { answers.surface = 'Fence/retaining wall'; stepPwCapture(); }),
			pick('Commercial property', function () { answers.surface = 'Commercial'; stepPwCapture(); })
		]);
	}
	function stepPwCapture() {
		stepMessage('Pressure washing is priced with a <b>free bid</b> — leave your info and we’ll text you one ASAP. 👇', 'I’d like a free pressure washing bid for: ' + answers.surface);
	}

	function stepMessage(intro, prefill) {
		botSay(intro, function () {
			var wrap = el('div', 'ibc-msg bot');
			wrap.appendChild(buildForm(prefill));
			body.appendChild(wrap);
			scrollDown();
			setChips([]);
		});
	}

	function summary() {
		var parts = [];
		if (answers.service) parts.push('Service: ' + answers.service);
		if (answers.plan) parts.push('Plan: ' + planName(answers.plan));
		if (answers.bins) parts.push('Bins: ' + answers.bins);
		if (answers.city !== undefined) parts.push('City: ' + (answers.city || '(outside listed areas)'));
		if (answers.surface) parts.push('Surface: ' + answers.surface);
		return parts.join(' · ');
	}

	function buildForm(prefill) {
		var f = el('form', 'ibc-chat-form');
		f.innerHTML =
			'<input type="text" name="name" placeholder="Your name" required>' +
			'<input type="text" name="contact" placeholder="Phone number (or email)" required>' +
			'<textarea name="message" placeholder="Anything else we should know?"></textarea>' +
			'<input type="text" name="ibc_website" style="position:absolute;left:-9999px" tabindex="-1" autocomplete="off" aria-hidden="true">' +
			'<span class="consent-note">By sending, you agree we may reply by text or email. Msg &amp; data rates may apply. Reply STOP to opt out.</span>' +
			'<span class="ibc-chat-err" hidden>Please add your name and a way to reach you.</span>' +
			'<button type="submit" class="btn btn-primary">Send</button>';
		if (prefill) f.message.value = prefill;
		f.addEventListener('submit', function (e) {
			e.preventDefault();
			var name = f.name.value.trim(), contact = f.contact.value.trim(), msg = f.message.value.trim();
			var err = f.querySelector('.ibc-chat-err');
			if (!name || !contact) { err.hidden = false; return; }
			err.hidden = true;
			var btn = f.querySelector('button');
			btn.disabled = true;
			btn.textContent = 'Sending…';
			var fullMsg = (summary() ? summary() + '\n\n' : '') + (msg || '(no extra message)');
			function done() {
				f.closest('.ibc-msg').remove();
				if (msg) userSay(msg);
				botSay('Got it, ' + name.split(' ')[0] + '! 🎉 We’ll text you back shortly — usually within the hour during business hours.', function () {
					setChips([pick('🔄 Start over', stepStart)]);
				});
			}
			if (!endpoint) { setTimeout(done, 600); return; } /* static preview: demo mode */
			var data = new FormData();
			data.append('action', 'ibc_chat');
			data.append('name', name);
			data.append('contact', contact);
			data.append('message', fullMsg);
			data.append('page', window.location.href);
			data.append('ibc_website', f.ibc_website.value);
			fetch(endpoint, { method: 'POST', body: data })
				.then(function (r) { return r.json(); })
				.then(function (j) {
					if (j && j.ok) { done(); }
					else { err.textContent = 'Something went wrong — please try again.'; err.hidden = false; btn.disabled = false; btn.textContent = 'Send'; }
				})
				.catch(function () { done(); }); /* never strand the visitor */
		});
		return f;
	}

	function start() {
		if (started) return;
		started = true;
		stepStart();
	}
	function setOpen(open) {
		root.classList.toggle('open', open);
		panel.hidden = !open;
		bubble.setAttribute('aria-expanded', open ? 'true' : 'false');
		if (open) {
			root.classList.remove('nudge');
			try { sessionStorage.setItem('ibc_chat_nudged', '1'); } catch (e) {}
			start();
		}
	}
	bubble.addEventListener('click', function () { setOpen(panel.hidden); });
	root.querySelector('.ibc-chat-x').addEventListener('click', function () { setOpen(false); });
	document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !panel.hidden) setOpen(false); });

	var nudged = false;
	try { nudged = sessionStorage.getItem('ibc_chat_nudged') === '1'; } catch (e) {}
	if (!nudged) {
		setTimeout(function () {
			if (panel.hidden) root.classList.add('nudge');
			try { sessionStorage.setItem('ibc_chat_nudged', '1'); } catch (e) {}
		}, 6000);
	}
})();
