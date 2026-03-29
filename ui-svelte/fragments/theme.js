import { writable } from 'svelte/store';

// The themes supported are 'dark' and 'light'

// Initialize the theme based on user's previous choices stored in localStorage
function getInitialTheme() {
    return localStorage.getItem('vmblu-theme') || 'dark'; // Default to 'light' if nothing in localStorage
}

// the global theme variable
export const theme = writable(getInitialTheme());

// save it when it changes
theme.subscribe(value => {
    localStorage.setItem('vmblu-theme', value);  // Update localStorage whenever the theme changes
});
