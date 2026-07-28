function logout() {
    localStorage.removeItem('teacher');
    window.location.href = 'index.html';
}

function checkAuth() {
    const teacher = localStorage.getItem('teacher');
    if (!teacher) {
        window.location.href = 'index.html';
        return null;
    }
    return JSON.parse(teacher);
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(err => console.log('SW Error:', err));
  });
}