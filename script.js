// ===== CONFIGURATION =====
const CONFIG = {
	// Google Sheets ID
	SHEET_ID: '1bwb3FdARKocw-bcC7owItLsl4dz_xd70_8nvgkySPo0',

	// Cloudinary configuration (опционально)
	CLOUDINARY: {
		cloud_name: 'your_cloud_name', // замените на ваш Cloudinary cloud_name
		base_url: 'https://res.cloudinary.com/your_cloud_name/image/upload/f_auto,q_auto/'
	},

	// Cache settings
	CACHE_DURATION: 5 * 60 * 1000, // 5 минут

	// Navigation settings
	SCROLL_OFFSET: 100, // Отступ для активации секции
};

// ===== API ENDPOINTS =====
const API_BASE = `https://opensheet.elk.sh/${CONFIG.SHEET_ID}`;

const ENDPOINTS = {
	categories: `${API_BASE}/Categories`,
	menu: `${API_BASE}/Menu`,
	locations: `${API_BASE}/Locations`
};

// ===== DATA LOADING =====
class DataService {
	constructor() {
		this.cache = new Map();
	}

	async loadData(endpoint, cacheKey) {
		// Проверяем кэш
		const cached = this.cache.get(cacheKey);
		if (cached && Date.now() - cached.timestamp < CONFIG.CACHE_DURATION) {
			console.log(`Using cached data for ${cacheKey}`);
			return cached.data;
		}

		try {
			console.log(`Loading data from ${endpoint}`);
			const response = await fetch(endpoint);

			if (!response.ok) {
				throw new Error(`HTTP error! status: ${response.status}`);
			}

			const data = await response.json();
			const filteredData = data.filter(item => item.name && item.name.trim());

			// Кэшируем данные
			this.cache.set(cacheKey, {
				data: filteredData,
				timestamp: Date.now()
			});

			return filteredData;
		} catch (error) {
			console.error(`Error loading data from ${endpoint}:`, error);
			throw error;
		}
	}

	async loadCategories() {
		return this.loadData(ENDPOINTS.categories, 'categories');
	}

	async loadMenu() {
		return this.loadData(ENDPOINTS.menu, 'menu');
	}

	async loadLocations() {
		return this.loadData(ENDPOINTS.locations, 'locations');
	}
}

// ===== ANIMATION OBSERVER =====
class AnimationObserver {
    constructor() {
        this.observer = null;
        this.init();
    }

    init() {
        // Проверяем поддержку Intersection Observer
        if ('IntersectionObserver' in window) {
            this.observer = new IntersectionObserver(
                (entries) => this.handleIntersection(entries),
                {
                    threshold: 0.3, // Запускаем анимацию когда 30% элемента видно
                    rootMargin: '0px 0px 0px 0px' // Без отступа, чтобы анимация запускалась когда элемент хорошо виден
                }
            );
        }
    }

    handleIntersection(entries) {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                console.log('Element in view:', entry.target.id || entry.target.className);
                this.animateElement(entry.target);
                // Убираем наблюдение после анимации
                this.observer.unobserve(entry.target);
            }
        });
    }

    animateElement(element) {
        // Добавляем класс in-view для всех анимированных элементов
        if (element.classList.contains('animate-from-left') || element.classList.contains('animate-from-right')) {
            element.classList.add('in-view');
        }
    }

    observeElements() {
        if (!this.observer) return;

        // Наблюдаем за всеми секциями с классами animate-from-left и animate-from-right
        const sections = document.querySelectorAll('.menu-category.animate-from-left, .menu-category.animate-from-right, .locations-section.animate-from-right, .locations-section.animate-from-left');
        sections.forEach(section => {
            this.observer.observe(section);
            console.log('Observing section:', section.id);
        });

        // Специально проверяем секцию "Холодні напої"
        const holodniNapoiSection = document.getElementById('holodni-napoi');
        if (holodniNapoiSection) {
            console.log('Explicitly observing holodni-napoi section');
            this.observer.observe(holodniNapoiSection);
        } else {
            console.error('holodni-napoi section not found!');
        }
    }
}
// ===== NAVIGATION =====
class Navigation {
	constructor() {
		this.sidebar = document.getElementById('sidebar');
		this.sidebarContent = this.sidebar.querySelector('.sidebar-content');
		this.activeSection = null;
		this.isScrolling = false;

		this.init();
	}

	init() {
		this.createScrollTopButton();
		this.setupScrollListener();

		// Инициализируем сразу после создания
		setTimeout(() => {
			this.updateActiveSection();
		}, 500);
	}

	createScrollTopButton() {
		const scrollTopBtn = document.createElement('a');
		scrollTopBtn.href = '#top';
		scrollTopBtn.className = 'nav-item scroll-top';
		scrollTopBtn.innerHTML = '⬆️';
		scrollTopBtn.setAttribute('data-tooltip', 'Наверх');
		scrollTopBtn.setAttribute('data-section', 'top'); // Важно: добавляем data-section
		scrollTopBtn.addEventListener('click', (e) => {
			e.preventDefault();
			this.scrollToTop();
		});

		this.sidebarContent.appendChild(scrollTopBtn);
	}

	renderNavigation(categories) {
		// Очищаем существующие элементы навигации (кроме кнопки "наверх")
		const existingItems = this.sidebarContent.querySelectorAll('.nav-item:not(.scroll-top)');
		existingItems.forEach(item => item.remove());

		// Используем тот же порядок что и в меню - чебуреки первыми!
		const activeCategories = Utils.filterActive(categories);

		const sortedCategories = activeCategories.sort((a, b) => {
			// Если одна из категорий содержит "чебурек" - она идет первой
			const aIsCheburek = a.name.toLowerCase().includes('чебурек');
			const bIsCheburek = b.name.toLowerCase().includes('чебурек');

			if (aIsCheburek && !bIsCheburek) return -1;
			if (!aIsCheburek && bIsCheburek) return 1;

			// Для остальных - по обычному порядку
			return parseInt(a.order || 0) - parseInt(b.order || 0);
		});

		// Создаем элементы навигации для каждой категории
		sortedCategories.forEach(category => {
			const navItem = this.createNavItem(category);
			this.sidebarContent.insertBefore(navItem, this.sidebarContent.querySelector('.scroll-top'));
		});

		// Добавляем навигацию для локаций
		const locationsNavItem = this.createNavItem({
			name: 'Локації',
			icon: '📍',
			order: 999
		});
		this.sidebarContent.insertBefore(locationsNavItem, this.sidebarContent.querySelector('.scroll-top'));
	}

	createNavItem(category, customIcon = null) {
		const navItem = document.createElement('a');
		const sectionId = this.getSectionId(category.name);

		navItem.href = `#${sectionId}`;
		navItem.className = 'nav-item';
		navItem.setAttribute('data-section', sectionId);
		navItem.setAttribute('data-tooltip', category.name);

		// Берем иконку из категории или используем дефолтную
		const icon = customIcon || category.icon || '📋';
		navItem.innerHTML = icon;

		navItem.addEventListener('click', (e) => {
			e.preventDefault();
			console.log('Nav item clicked for section:', sectionId);

			// Small delay to allow DOM to update
			setTimeout(() => {
				this.scrollToSection(sectionId);
			}, 100);
		});

		return navItem;
	}

	getSectionId(categoryName) {
		console.log('Input category name:', categoryName);

		// Transliteration of Cyrillic to Latin
		const translitMap = {
			'а': 'a', 'б': 'b', 'в': 'v', 'г': 'g', 'д': 'd', 'е': 'e', 'ё': 'yo', 'ж': 'zh',
			'з': 'z', 'и': 'i', 'й': 'y', 'к': 'k', 'л': 'l', 'м': 'm', 'н': 'n', 'о': 'o',
			'п': 'p', 'р': 'r', 'с': 's', 'т': 't', 'у': 'u', 'ф': 'f', 'х': 'h', 'ц': 'ts',
			'ч': 'ch', 'ш': 'sh', 'щ': 'sch', 'ъ': '', 'ы': 'y', 'ь': '', 'э': 'e', 'ю': 'yu', 'я': 'ya',
			'і': 'i', 'ї': 'i', 'є': 'ye'
		};

		let id = categoryName.toLowerCase();

		// Replace Cyrillic with Latin
		for (let [cyr, lat] of Object.entries(translitMap)) {
			id = id.replace(new RegExp(cyr, 'g'), lat);
		}

		// Clean and format
		id = id
			.replace(/\s+/g, '-')           // spaces to hyphens
			.replace(/[^\w\-]/g, '')        // only letters, numbers and hyphens
			.replace(/\-+/g, '-')           // multiple hyphens to one
			.replace(/^\-|\-$/g, '');       // remove hyphens at start/end

		// Special cases
		if (categoryName.includes('окаці') || categoryName.includes('Локаці')) {
			id = 'locations';
		}

		console.log('Generated section ID for', categoryName, '→', id);
		return id || 'section'; // fallback если ID пустой
	}

	scrollToSection(sectionId) {
		console.log('=== SCROLL DEBUG ===');
		console.log('Trying to scroll to section:', sectionId);

		// Check all available sections
		const allSections = document.querySelectorAll('[id]');
		console.log('All elements with IDs:', Array.from(allSections).map(el => el.id));

		const element = document.getElementById(sectionId);
		console.log('Found element:', element);

		if (element) {
			this.isScrolling = true;

			const elementPosition = element.offsetTop;
			console.log('Element offsetTop:', elementPosition);

			const offsetPosition = Math.max(0, elementPosition - 100); // Top offset
			console.log('Scroll to position:', offsetPosition);

			window.scrollTo({
				top: offsetPosition,
				behavior: 'smooth'
			});

			// Set active section immediately
			this.setActiveNavItem(sectionId);

			// Reset flag after animation time
			setTimeout(() => {
				this.isScrolling = false;
				this.updateActiveSection(); // Force update after scroll
				console.log('Scroll completed');
			}, 1000);
		} else {
			console.error('Section not found! ID:', sectionId);
			console.log('Available sections:', document.querySelectorAll('.menu-category, .locations-section'));
		}

		console.log('=== END SCROLL DEBUG ===');
	}

	// Helper method for scrolling to an element
	scrollToElement(element) {
		if (!element) return;

		this.isScrolling = true;

		const elementPosition = element.offsetTop;
		console.log('Element offsetTop:', elementPosition);

		const offsetPosition = Math.max(0, elementPosition - 100);
		console.log('Scroll to position:', offsetPosition);

		window.scrollTo({
			top: offsetPosition,
			behavior: 'smooth'
		});

		// Устанавливаем активную секцию сразу
		if (element.id) {
			this.setActiveNavItem(element.id);
		}

		// Сбрасываем флаг через время анимации
		setTimeout(() => {
			this.isScrolling = false;
			this.updateActiveSection();
			console.log('Scroll completed');

			// Добавляем класс in-view для анимации
			if (element.classList.contains('animate-from-left') || element.classList.contains('animate-from-right')) {
				console.log('Adding in-view class to element');
				element.classList.add('in-view');
			}
		}, 1000);
	}

	scrollToTop() {
		console.log('Scrolling to top');
		this.isScrolling = true;

		window.scrollTo({
			top: 0,
			behavior: 'smooth'
		});

		// Сразу устанавливаем активную секцию на "top"
		this.setActiveNavItem('top');

		setTimeout(() => {
			this.isScrolling = false;
			// Не вызываем updateActiveSection здесь, так как уже установили правильную секцию
			console.log('Scroll to top completed');
		}, 1000);
	}

	setupScrollListener() {
		let ticking = false;

		window.addEventListener('scroll', () => {
			if (!ticking) {
				requestAnimationFrame(() => {
					if (!this.isScrolling) {
						this.updateActiveSection();
					}
					ticking = false;
				});
				ticking = true;
			}
		});

		// Также слушаем изменения в DOM
		window.addEventListener('load', () => {
			setTimeout(() => this.updateActiveSection(), 1000);
		});
	}

	updateActiveSection() {
		const sections = document.querySelectorAll('.menu-category, .locations-section');
		const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
		const windowHeight = window.innerHeight;
		const documentHeight = document.documentElement.scrollHeight;

		console.log('Current scroll position:', scrollTop);
		console.log('Window height:', windowHeight, 'Document height:', documentHeight);

		let activeSection = null;

		// Check if we are at the very bottom of the page
		const isAtBottom = (scrollTop + windowHeight) >= (documentHeight - 50);
		if (isAtBottom) {
			// If at the bottom of the page, activate the last section (locations)
			const lastSection = sections[sections.length - 1];
			if (lastSection) {
				activeSection = lastSection.id;
				console.log('Active section: bottom ->', activeSection);
			}
		}
		// Check if we are at the top of the page
		else if (scrollTop < 250) {
			activeSection = 'top';
			console.log('Active section: top (scroll position < 250)');
		}
		// Normal logic for finding the active section
		else {
			let closestSection = null;
			let closestDistance = Infinity;

			sections.forEach(section => {
				const rect = section.getBoundingClientRect();

				// Distance from the top of the screen to the section
				const distanceFromTop = Math.abs(rect.top - 100);

				// If the section is visible in the upper part of the screen
				if (rect.top <= 200 && rect.bottom > 100) {
					if (distanceFromTop < closestDistance) {
						closestDistance = distanceFromTop;
						closestSection = section.id;
					}

				}

			});


			if (closestSection) {
				activeSection = closestSection;
				console.log('Active section:', activeSection, 'distance:', closestDistance);
			}
		}

		if (activeSection && activeSection !== this.activeSection) {
			this.setActiveNavItem(activeSection);
		}
	}

	setActiveNavItem(sectionId) {
		if (this.activeSection === sectionId) return;

		console.log('Setting active nav item:', sectionId);

		// Remove active class from all elements
		this.sidebarContent.querySelectorAll('.nav-item').forEach(item => {
			item.classList.remove('active');
		});

		// Add active class to the corresponding element
		const activeItem = this.sidebarContent.querySelector(`[data-section="${sectionId}"]`);
		if (activeItem) {
			activeItem.classList.add('active');
			console.log('Activated nav item for section:', sectionId);
		} else {
			console.log('Nav item not found for section:', sectionId);
		}

		this.activeSection = sectionId;
	}
}

const Utils = {
	// Get image URL (priority: image_url, fallback to Cloudinary)
	getImageUrl(item) {
		// First check direct image link
		if (item.image_url && item.image_url.trim()) {
			return item.image_url.trim();
		}

		// Fallback to Cloudinary if cloudinary_id exists
		if (item.cloudinary_id && CONFIG.CLOUDINARY.cloud_name !== 'your_cloud_name') {
			return `${CONFIG.CLOUDINARY.base_url}${item.cloudinary_id}`;
		}

		return null;
	},

	// Filter active items
	filterActive(items) {
		return items.filter(item => item.active === 'TRUE' || item.active === true);
	},

	// Sort by order
	sortByOrder(items) {
		return items.sort((a, b) => parseInt(a.order || 0) - parseInt(b.order || 0));
	},

	// Group items by category
	groupByCategory(menuItems) {
		const grouped = {};
		menuItems.forEach(item => {
			const category = item.category;
			if (!grouped[category]) {
				grouped[category] = [];
			}
			grouped[category].push(item);
		});
		return grouped;
	},

	// Safe price formatting
	formatPrice(price) {
		if (!price) return '';
		return price.toString().includes('₴') ? price : `${price} ₴`;
	}
};

// ===== RENDERING =====
class Renderer {
	constructor() {
		this.menuContainer = document.getElementById('menu');
		this.locationsContainer = document.getElementById('locations');
		this.loadingElement = document.getElementById('loading');
		this.navigation = new Navigation();
		this.animationObserver = new AnimationObserver(); // Инициализируем AnimationObserver
	}

	renderMenu(categories, menuItems) {
		// Получаем активные элементы меню
		const activeMenuItems = Utils.filterActive(menuItems);
		const itemsByCategory = Utils.groupByCategory(activeMenuItems);

		// Определяем соответствие между названиями категорий и ID секций
		const categoryMapping = {
			'Холодні напої': 'holodni-napoi',
			'Лимонади': 'limonadi',
			'Чебуреки': 'chebureki',
			'Солодкі чебуреки': 'solodki-chebureki',
			'Додатки': 'dodatki'
		};

		// Для каждой фиксированной секции находим соответствующие элементы
		Object.entries(categoryMapping).forEach(([categoryName, sectionId]) => {
			const sectionElement = document.getElementById(sectionId);
			if (!sectionElement) return;

			const menuItemsContainer = sectionElement.querySelector('.menu-items');
			if (!menuItemsContainer) return;

			// Find items for this category
			const items = itemsByCategory[categoryName] || [];
			const sortedItems = Utils.sortByOrder(items);

			// Fill the container with items
			menuItemsContainer.innerHTML = sortedItems.map(item => this.renderMenuItem(item)).join('');

			// If no items, hide the section
			if (sortedItems.length === 0) {
				sectionElement.style.display = 'none';
			}
		});

		// Render navigation for fixed sections
		const activeCategories = Utils.filterActive(categories);
		this.navigation.renderNavigation(activeCategories);

		// Force navigation update after a small delay
		setTimeout(() => {
			console.log('Menu rendered, checking sections...');
			const sections = document.querySelectorAll('.menu-category');
			console.log('Found sections:', Array.from(sections).map(s => s.id));
			this.navigation.updateActiveSection();

			// Start observing animations
			this.animationObserver.observeElements();

		}, 500);
	}

	renderMenuItem(item) {
		const imageUrl = Utils.getImageUrl(item);
		const hasImage = !!imageUrl;

		return `
            <div class="menu-item ${hasImage ? 'with-image' : ''}" data-item="${item.name}">
                ${hasImage ? `<img src="${imageUrl}" alt="${item.name}" class="item-image" loading="lazy" onerror="this.style.display='none';">` : ''}
                <div class="item-content">
                    <div class="item-header">
                        <span class="item-name">${item.name}</span>
                        <span class="item-price">${Utils.formatPrice(item.price)}</span>
                    </div>
                    ${item.volume_weight ? `<div class="item-details">📏 ${item.volume_weight}</div>` : ''}
                    ${item.description ? `<div class="item-details">📝 ${item.description}</div>` : ''}
                </div>
            </div>
        `;
	}

	renderLocations(locations) {
		const activeLocations = Utils.sortByOrder(Utils.filterActive(locations));

		// Add location cards to the existing container
		const locationCards = activeLocations.map(location => this.renderLocationCard(location)).join('');
		this.locationsContainer.innerHTML += locationCards;

		// If no locations, hide the section
		if (activeLocations.length === 0) {
			this.locationsContainer.style.display = 'none';
		}

		// Start observing animations after rendering locations
		setTimeout(() => {
			this.animationObserver.observeElements();
		}, 100);
	}

	renderLocationCard(location) {
		// Check if image exists
		const hasImage = location.image_url && location.image_url.trim();

		return `
            <div class="location-card ${hasImage ? 'with-image' : ''}">
                ${hasImage ? `
                <div class="location-card-image-container">
                    <img src="${location.image_url}" alt="${location.name}" class="location-card-image" loading="lazy" onerror="this.style.display='none';">
                </div>` : ''}
                <div class="location-card-content">
                    <div class="location-name">${location.name}</div>
                    <div class="location-info">📍 ${location.address}</div>
                    <div class="location-info">📞 <a href="tel:${location.phone}" class="phone">${location.phone}</a></div>
                    ${location.working_hours ? `<div class="location-info">🕒 ${location.working_hours}</div>` : ''}
                    ${location.description ? `<div class="location-info">ℹ️ ${location.description}</div>` : ''}
                    ${location.google_maps_url ? `<a href="${location.google_maps_url}" target="_blank" class="maps-link">Відкрити в Google Maps</a>` : ''}
                </div>
            </div>
        `;
	}

	showError(message) {
		this.loadingElement.innerHTML = `
            <div class="error">
                <h3>❌ Помилка завантаження</h3>
                <p>${message}</p>
                <p>Спробуйте оновити сторінку або зверніться до адміністратора.</p>
                <button onclick="location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; background: #e74c3c; color: white; border: none; border-radius: 5px; cursor: pointer;">
                    Оновити сторінку
                </button>
            </div>
        `;
	}

	hideLoading() {
		this.loadingElement.style.display = 'none';
	}
}

// ===== MAIN APPLICATION =====
class ChebufechnaApp {
	constructor() {
		this.dataService = new DataService();
		this.renderer = new Renderer();
	}

	async init() {
		try {
			console.log('🚀 Initializing Cheburechna App...');

			// Show loading progress
			this.updateLoadingStatus('Завантаження категорій...');

			// Load all data in parallel
			const [categories, menuItems, locations] = await Promise.all([
				this.dataService.loadCategories(),
				this.dataService.loadMenu(),
				this.dataService.loadLocations()
			]);

			console.log('📊 Data loaded:', {
				categories: categories.length,
				menuItems: menuItems.length,
				locations: locations.length
			});

			// Hide loading
			this.renderer.hideLoading();

			// Render content
			this.renderer.renderMenu(categories, menuItems);
			this.renderer.renderLocations(locations);

			console.log('✅ App initialized successfully!');

		} catch (error) {
			console.error('❌ App initialization failed:', error);
			this.renderer.showError(`Не вдалося завантажити дані: ${error.message}`);
		}
	}

	updateLoadingStatus(status) {
		const loadingElement = document.getElementById('loading');
		if (loadingElement) {
			loadingElement.innerHTML = `<h3>⏳ ${status}</h3>`;
		}
	}

	// Method for manual data refresh
	async refresh() {
		this.dataService.cache.clear();
		await this.init();
	}
}

// ===== INITIALIZATION =====
const app = new ChebufechnaApp();

// Запускаем приложение после загрузки DOM
document.addEventListener('DOMContentLoaded', () => {
	// Добавляем id="top" к body для навигации
	document.body.id = 'top';
	app.init();
});

// Добавляем глобальную функцию для обновления (можно вызвать из консоли)
window.refreshMenu = () => app.refresh();

// Обработка ошибок на уровне приложения
window.addEventListener('error', (event) => {
	console.error('Global error:', event.error);
});

// Логирование для отладки
console.log('🥟 Cheburechna script loaded!');
console.log('📋 Endpoints:', ENDPOINTS);
console.log('⚙️ Config:', CONFIG);
