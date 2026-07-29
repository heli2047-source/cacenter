document.addEventListener('DOMContentLoaded', () => {
  // Mobile Menu Toggle
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const navLinks = document.getElementById('navLinks');

  if (mobileMenuBtn && navLinks) {
    const closeMenu = () => {
      navLinks.classList.remove('active');
    };

    mobileMenuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      e.preventDefault();
      navLinks.classList.toggle('active');
    });

    // Event delegation: closing menu on link click/tap
    navLinks.addEventListener('click', (e) => {
      const link = e.target.closest('a');
      if (link) {
        closeMenu();
      }
    });

    // Close menu when clicking anywhere outside header
    document.addEventListener('click', (e) => {
      if (!navLinks.contains(e.target) && !mobileMenuBtn.contains(e.target)) {
        closeMenu();
      }
    });
  }

  // FAQ Accordion Toggle
  const faqItems = document.querySelectorAll('.faq-item');

  faqItems.forEach(item => {
    const questionBtn = item.querySelector('.faq-question');
    const answer = item.querySelector('.faq-answer');

    if (questionBtn && answer) {
      questionBtn.addEventListener('click', () => {
        const isActive = item.classList.contains('active');

        // Close all other FAQ items
        faqItems.forEach(otherItem => {
          otherItem.classList.remove('active');
          const otherAnswer = otherItem.querySelector('.faq-answer');
          if (otherAnswer) otherAnswer.style.maxHeight = null;
        });

        // Toggle current item
        if (!isActive) {
          item.classList.add('active');
          answer.style.maxHeight = answer.scrollHeight + 'px';
        }
      });
    }
  });

  // Centralized WhatsApp Handler with Custom Messages per Action
  const defaultPhone = '5519992448454';

  const customWaMessages = {
    hero_quote: 'Olá, CACENTER! Vim pelo site e gostaria de solicitar um orçamento para aluguel de veículo.',
    contact_direct: 'Olá, equipe CACENTER! Gostaria de tirar dúvidas e falar com um consultor sobre locação.',
    floating_chat: 'Olá! Vim pelo site da CACENTER e gostaria de mais informações sobre os planos de locação.'
  };

  // Fleet reservation buttons
  const fleetButtons = document.querySelectorAll('[data-car-model]');
  fleetButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const carModel = btn.getAttribute('data-car-model');
      const message = encodeURIComponent(`Olá, CACENTER! Gostaria de consultar a disponibilidade e reservar o veículo: *${carModel}*.`);
      window.open(`https://wa.me/${defaultPhone}?text=${message}`, '_blank');
    });
  });

  // Action-specific WhatsApp buttons
  const actionWaButtons = document.querySelectorAll('[data-wa-action]');
  actionWaButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const action = btn.getAttribute('data-wa-action');
      const text = customWaMessages[action] || 'Olá, CACENTER! Gostaria de solicitar mais informações.';
      window.open(`https://wa.me/${defaultPhone}?text=${encodeURIComponent(text)}`, '_blank');
    });
  });

  // Navbar background change on scroll
  const navbar = document.querySelector('.navbar');
  window.addEventListener('scroll', () => {
    if (window.scrollY > 50) {
      navbar.style.padding = '10px 0';
      navbar.style.background = 'rgba(9, 13, 22, 0.95)';
    } else {
      navbar.style.padding = '16px 0';
      navbar.style.background = 'rgba(9, 13, 22, 0.85)';
    }
  });
});
