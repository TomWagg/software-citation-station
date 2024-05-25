document.querySelector('#dark-mode-checkbox').addEventListener('change', function () {
    if (this.checked) {
        document.body.classList.add('dark')
        document.documentElement.setAttribute('data-bs-theme', 'dark')
        document.getElementById('main-logo').src = 'img/software-citation-station-no-circle.png'
    } else {
        document.body.classList.remove('dark')
        document.documentElement.setAttribute('data-bs-theme', 'light')
        document.getElementById('main-logo').src = 'img/software-citation-station-no-circle-blue.png'
    }
})

let now = new Date()
if (now.getHours() >= 19 || now.getHours() < 6) {
    document.querySelector('#dark-mode-checkbox').click()
}
