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
