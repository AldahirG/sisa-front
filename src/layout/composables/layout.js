import { computed, reactive } from 'vue';

// ── Persistencia de preferencias ─────────────────────────────────
const STORAGE_KEY = 'sisa-layout';

function loadPrefs() {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch {
        return {};
    }
}

function savePrefs(config) {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
            preset:    config.preset,
            primary:   config.primary,
            surface:   config.surface,
            darkTheme: config.darkTheme,
            menuMode:  config.menuMode
        }));
    } catch { /* storage not available */ }
}

const prefs = loadPrefs();

const layoutConfig = reactive({
    preset:    prefs.preset    ?? 'Aura',
    primary:   prefs.primary   ?? 'blue',
    surface:   prefs.surface   ?? 'slate',
    darkTheme: prefs.darkTheme ?? false,
    menuMode:  prefs.menuMode  ?? 'static'
});

// Aplicar dark mode guardado al arrancar
if (layoutConfig.darkTheme) {
    document.documentElement.classList.add('app-dark');
}

const layoutState = reactive({
    staticMenuDesktopInactive: false,
    overlayMenuActive: false,
    profileSidebarVisible: false,
    configSidebarVisible: false,
    staticMenuMobileActive: false,
    menuHoverActive: false,
    activeMenuItem: null
});

export function useLayout() {
    const setActiveMenuItem = (item) => {
        layoutState.activeMenuItem = item.value || item;
    };

    const toggleDarkMode = () => {
        if (!document.startViewTransition) {
            executeDarkModeToggle();

            return;
        }

        document.startViewTransition(() => executeDarkModeToggle(event));
    };

    const executeDarkModeToggle = () => {
        layoutConfig.darkTheme = !layoutConfig.darkTheme;
        document.documentElement.classList.toggle('app-dark');
        savePrefs(layoutConfig);
    };

    const toggleMenu = () => {
        if (layoutConfig.menuMode === 'overlay') {
            layoutState.overlayMenuActive = !layoutState.overlayMenuActive;
        }

        if (window.innerWidth > 991) {
            layoutState.staticMenuDesktopInactive = !layoutState.staticMenuDesktopInactive;
        } else {
            layoutState.staticMenuMobileActive = !layoutState.staticMenuMobileActive;
        }
    };

    const isSidebarActive = computed(() => layoutState.overlayMenuActive || layoutState.staticMenuMobileActive);

    const isDarkTheme = computed(() => layoutConfig.darkTheme);

    const getPrimary = computed(() => layoutConfig.primary);

    const getSurface = computed(() => layoutConfig.surface);

    const saveLayoutPrefs = () => savePrefs(layoutConfig);

    return {
        layoutConfig,
        layoutState,
        toggleMenu,
        isSidebarActive,
        isDarkTheme,
        getPrimary,
        getSurface,
        setActiveMenuItem,
        toggleDarkMode,
        saveLayoutPrefs
    };
}
