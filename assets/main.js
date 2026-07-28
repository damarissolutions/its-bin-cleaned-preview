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
