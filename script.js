/**
 * saca_demo - Salary Calculator
 * Modular Refactored Version
 */

const SALARY_CATEGORIES = {
    minimum: { name: 'Мінімальна зарплата', min: 8000, max: 16000, description: 'Початковий рівень, стажер' },
    average: { name: 'Середня зарплата', min: 16000, max: 45000, description: 'Досвідчений спеціаліст' },
    high: { name: 'Висока зарплата', min: 45000, max: null, description: 'Старший спеціаліст, керівник' }
};

class StorageManager {
    static FORM_DATA_KEY = 'salaryCalcFormData';
    
    static saveFormData(data) {
        localStorage.setItem(this.FORM_DATA_KEY, JSON.stringify(data));
    }
    
    static loadFormData() {
        const data = localStorage.getItem(this.FORM_DATA_KEY);
        try {
            return data ? JSON.parse(data) : null;
        } catch (e) {
            return null;
        }
    }
}

class CurrencyManager {
    static CACHE_KEY = 'salaryCalcRates';
    static CACHE_DURATION_MS = 24 * 60 * 60 * 1000;
    
    constructor() {
        this.rates = {
            UAH: { symbol: '₴', name: 'Гривня', rate: 1 },
            EUR: { symbol: '€', name: 'Євро', rate: 0.025 },
            USD: { symbol: '$', name: 'Долар США', rate: 0.027 }
        };
    }

    async fetchRates() {
        const cached = localStorage.getItem(CurrencyManager.CACHE_KEY);
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (Date.now() - parsed.timestamp < CurrencyManager.CACHE_DURATION_MS) {
                    this.rates.EUR.rate = 1 / parsed.rates.EUR;
                    this.rates.USD.rate = 1 / parsed.rates.USD;
                    return;
                }
            } catch (e) {
                console.warn('Failed to parse cached rates', e);
            }
        }

        try {
            const response = await fetch('https://bank.gov.ua/NBUStatService/v1/statdirectory/exchange?json');
            if (response.ok) {
                const data = await response.json();
                const eurRate = data.find(item => item.cc === 'EUR')?.rate;
                const usdRate = data.find(item => item.cc === 'USD')?.rate;
                
                if (eurRate && usdRate) {
                    this.rates.EUR.rate = 1 / eurRate;
                    this.rates.USD.rate = 1 / usdRate;
                
                    localStorage.setItem(CurrencyManager.CACHE_KEY, JSON.stringify({
                        rates: { EUR: eurRate, USD: usdRate },
                        timestamp: Date.now()
                    }));
                }
            }
        } catch (e) {
            console.warn('Failed to fetch NBU rates, falling back to static ones', e);
        }
    }

    getCurrency(code) {
        return this.rates[code] || this.rates['UAH'];
    }
}

class TaxCalculator {
    static getEsvInCurrency(currencyRate, currencyCode) {
        const esvUAH = 1760; // ЄСВ ~1760 UAH (22% від мінімальної заробітної плати 8000 UAH)
        return (currencyCode === 'UAH') ? esvUAH : (esvUAH * currencyRate);
    }

    static calculateNet(grossIncome, taxType, currencyRate, currencyCode, includeFixedFees = true) {
        if (taxType === 'gross') return grossIncome;
        
        if (taxType === 'fop') {
            const esv = includeFixedFees ? this.getEsvInCurrency(currencyRate, currencyCode) : 0;
            const singleTax = grossIncome * 0.05; // 5% єдиний податок
            return Math.max(0, grossIncome - singleTax - esv); 
        } else if (taxType === 'official') {
            const tax = grossIncome * 0.195; // 18% ПДФО + 1.5% ВЗ
            return Math.max(0, grossIncome - tax);
        }
        return grossIncome;
    }
}

class ThemeManager {
    static THEME_KEY = 'salaryCalcTheme';

    constructor() {
        this.themeToggleBtn = document.getElementById('themeToggle');
        this.icon = this.themeToggleBtn?.querySelector('i');
        this.init();
    }

    init() {
        if (!this.themeToggleBtn) return;
        
        // Load saved theme or check system preference
        const savedTheme = localStorage.getItem(ThemeManager.THEME_KEY);
        if (savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches)) {
            this.setTheme('dark');
        } else {
            this.setTheme('light');
        }

        // Add event listener
        this.themeToggleBtn.addEventListener('click', () => this.toggleTheme());
    }

    toggleTheme() {
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        this.setTheme(isDark ? 'light' : 'dark');
    }

    setTheme(theme) {
        if (theme === 'dark') {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem(ThemeManager.THEME_KEY, 'dark');
            if(this.icon) {
                this.icon.classList.remove('fa-moon');
                this.icon.classList.add('fa-sun');
            }
        } else {
            document.documentElement.removeAttribute('data-theme');
            localStorage.setItem(ThemeManager.THEME_KEY, 'light');
            if(this.icon) {
                this.icon.classList.remove('fa-sun');
                this.icon.classList.add('fa-moon');
            }
        }
        
        // Trigger chart redraw if exists
        if(window.app && window.app.salaryChart) {
            window.app.recalculateIfVisible();
        }
    }
}

class App {
    constructor() {
        this.currencyManager = new CurrencyManager();
        this.themeManager = new ThemeManager();
        this.salaryChart = null;
        this.form = document.getElementById('salaryForm');
        this.resultsSection = document.getElementById('resultsSection');
        
        this.elements = {
            currency: document.getElementById('currency'),
            salaryCategory: document.getElementById('salaryCategory'),
            taxType: document.getElementById('taxType'),
            currentSalary: document.getElementById('currentSalary'),
            experienceYears: document.getElementById('experienceYears'),
            annualGrowth: document.getElementById('annualGrowth'),
            projectionYears: document.getElementById('projectionYears'),
            bonusPercentage: document.getElementById('bonusPercentage'),
            inflationRate: document.getElementById('inflationRate')
        };
        
        this.init();
    }

    async init() {
        await this.currencyManager.fetchRates();
        this.setupEventListeners();
        this.loadSavedData();
        this.updateSalarySuggestions();
        this.addTooltips();
    }

    setupEventListeners() {
        this.form.addEventListener('submit', (e) => this.handleFormSubmit(e));
        
        this.form.addEventListener('change', () => {
            if (this.validateFormData(this.getFormData(), false)) {
                StorageManager.saveFormData(this.getFormData());
            }
        });

        this.elements.currency.addEventListener('change', () => {
            this.updateSalarySuggestions();
            this.recalculateIfVisible();
        });

        this.elements.salaryCategory.addEventListener('change', () => this.updateSalarySuggestions());
        this.elements.taxType.addEventListener('change', () => this.recalculateIfVisible());
        this.elements.currentSalary.addEventListener('input', () => this.validateSalaryInput());

        document.addEventListener('keydown', (event) => {
            if (event.ctrlKey && event.key === 'Enter') {
                this.form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
            }
        });
    }

    loadSavedData() {
        const savedData = StorageManager.loadFormData();
        if (savedData) {
            Object.keys(this.elements).forEach(key => {
                if (savedData[key] !== undefined && this.elements[key]) {
                    this.elements[key].value = savedData[key];
                }
            });
        }
    }

    recalculateIfVisible() {
        if (this.resultsSection.style.display !== 'none') {
            const formData = this.getFormData();
            if (this.validateFormData(formData, false)) {
                this.calculateAndDisplayResults(formData);
            }
        }
    }

    updateSalarySuggestions() {
        const category = this.elements.salaryCategory.value;
        const categoryData = SALARY_CATEGORIES[category] || SALARY_CATEGORIES.average;
        const currencyCode = this.elements.currency.value;
        const currency = this.currencyManager.getCurrency(currencyCode);
        
        const minInCurrency = Math.round(categoryData.min * currency.rate);
        const maxInCurrency = categoryData.max ? Math.round(categoryData.max * currency.rate) : null;
        
        if (maxInCurrency) {
            this.elements.currentSalary.placeholder = `${categoryData.description} (~${minInCurrency.toLocaleString()} - ${maxInCurrency.toLocaleString()} ${currency.symbol})`;
        } else {
            this.elements.currentSalary.placeholder = `${categoryData.description} (від ${minInCurrency.toLocaleString()} ${currency.symbol})`;
        }
        
        this.elements.currentSalary.min = "1";
        this.elements.currentSalary.removeAttribute('max');
        this.validateSalaryInput();
    }

    validateSalaryInput() {
        const value = parseFloat(this.elements.currentSalary.value);
        if (isNaN(value)) {
            this.elements.currentSalary.setCustomValidity('');
            return;
        }

        if (value <= 0) {
            this.elements.currentSalary.setCustomValidity('Сума зарплати повинна бути більше 0');
        } else {
            this.elements.currentSalary.setCustomValidity('');
        }
    }

    getFormData() {
        return {
            currency: this.elements.currency.value,
            salaryCategory: this.elements.salaryCategory.value,
            taxType: this.elements.taxType ? this.elements.taxType.value : 'gross',
            currentSalary: parseFloat(this.elements.currentSalary.value),
            experienceYears: parseInt(this.elements.experienceYears.value),
            annualGrowth: parseFloat(this.elements.annualGrowth.value),
            projectionYears: parseInt(this.elements.projectionYears.value),
            bonusPercentage: parseFloat(this.elements.bonusPercentage.value) || 0,
            inflationRate: parseFloat(this.elements.inflationRate.value) || 0
        };
    }

    validateFormData(data, showAlerts = true) {
        if (isNaN(data.currentSalary) || data.currentSalary <= 0) {
            if(showAlerts) alert('Будь ласка, введіть коректну зарплату');
            return false;
        }
        if (isNaN(data.experienceYears) || data.experienceYears < 0 || data.experienceYears > 50) {
            if(showAlerts) alert('Роки досвіду повинні бути від 0 до 50');
            return false;
        }
        if (isNaN(data.annualGrowth) || data.annualGrowth < 0 || data.annualGrowth > 100) {
            if(showAlerts) alert('Річний ріст повинен бути від 0 до 100%');
            return false;
        }
        if (isNaN(data.projectionYears) || data.projectionYears < 1 || data.projectionYears > 20) {
            if(showAlerts) alert('Років для прогнозу повинно бути від 1 до 20');
            return false;
        }
        return true;
    }

    handleFormSubmit(event) {
        event.preventDefault();
        const formData = this.getFormData();
        
        if (this.validateFormData(formData)) {
            StorageManager.saveFormData(formData);
            this.calculateAndDisplayResults(formData);
        }
    }

    calculateAndDisplayResults(data) {
        const results = this.calculateSalaryProjection(data);
        this.displayResults(results, data);
        this.createChart(results, data);
    }

    calculateSalaryProjection(data) {
        const results = [];
        let currentGrossSalary = data.currentSalary;
        const annualGrowthRate = data.annualGrowth / 100;
        const bonusRate = data.bonusPercentage / 100;
        const currency = this.currencyManager.getCurrency(data.currency);
        
        // Інфляція (економічна модель дисконтування)
        const currentYear = new Date().getFullYear();
        const inflationRate = (data.inflationRate || 0) / 100;
        
        for (let year = 0; year <= data.projectionYears; year++) {
            const yearNumber = currentYear + year;
            
            const grossBonus = currentGrossSalary * bonusRate;
            
            // ЄСВ утримується 1 раз з окладу (а не дублюється з премії)
            const netSalary = TaxCalculator.calculateNet(currentGrossSalary, data.taxType, currency.rate, data.currency, true);
            const netBonus = TaxCalculator.calculateNet(grossBonus, data.taxType, currency.rate, data.currency, false);
            const netTotalIncome = netSalary + netBonus;
            
            // Реальна вартість грошей (купівельна спроможність через дисконтування)
            const realValue = inflationRate > 0 
                ? netTotalIncome / Math.pow(1 + inflationRate, year)
                : netTotalIncome;
            
            results.push({
                year: yearNumber,
                grossSalary: currentGrossSalary,
                salary: netSalary,
                bonus: netBonus,
                totalIncome: netTotalIncome,
                realValue: realValue,
                growthFromPrevious: year === 0 ? 0 : ((netSalary - results[year - 1].salary) / results[year - 1].salary * 100)
            });
            
            currentGrossSalary = currentGrossSalary * (1 + annualGrowthRate);
        }
        
        return results;
    }

    formatCurrency(amount, currency, short = false) {
        if (short && amount >= 1000000) {
            return `${(amount / 1000000).toFixed(1)}М ${currency.symbol}`;
        } else if (short && amount >= 1000) {
            return `${(amount / 1000).toFixed(1)}К ${currency.symbol}`;
        }
        return `${Math.round(amount).toLocaleString()} ${currency.symbol}`;
    }

    displayResults(results, data) {
        const currency = this.currencyManager.getCurrency(data.currency);
        
        document.getElementById('currentSalaryDisplay').textContent = 
            this.formatCurrency(results[0].salary, currency);
        
        document.getElementById('projectedSalaryDisplay').textContent = 
            this.formatCurrency(results[results.length - 1].salary, currency);
        
        const totalGrowth = ((results[results.length - 1].salary - results[0].salary) / results[0].salary * 100) || 0;
        document.getElementById('totalGrowthDisplay').textContent = 
            `${totalGrowth.toFixed(1)}%`;
        
        const totalBonus = results.reduce((sum, result) => sum + result.bonus, 0);
        document.getElementById('totalBonusDisplay').textContent = 
            this.formatCurrency(totalBonus, currency);
        
        this.updateProjectionTable(results, currency);
        
        this.resultsSection.style.display = 'block';
        setTimeout(() => this.resultsSection.scrollIntoView({ behavior: 'smooth' }), 50);
    }

    updateProjectionTable(results, currency) {
        const tbody = document.getElementById('projectionTableBody');
        tbody.innerHTML = '';
        
        results.forEach((result) => {
            const row = document.createElement('tr');
            const growthClass = result.growthFromPrevious > 0 ? 'positive' : 
                               result.growthFromPrevious < 0 ? 'negative' : '';
            
            row.innerHTML = `
                <td>${result.year}</td>
                <td>${this.formatCurrency(result.salary, currency)}</td>
                <td>${this.formatCurrency(result.bonus, currency)}</td>
                <td><strong>${this.formatCurrency(result.totalIncome, currency)}</strong></td>
                <td style="color: #ffb347;"><strong>${this.formatCurrency(result.realValue, currency)}</strong></td>
                <td class="${growthClass}">
                    ${result.growthFromPrevious > 0 ? '+' : ''}${result.growthFromPrevious.toFixed(1)}%
                </td>
            `;
            tbody.appendChild(row);
        });
    }

    createChart(results, data) {
        const ctx = document.getElementById('salaryChart').getContext('2d');
        
        if (this.salaryChart) {
            this.salaryChart.destroy();
        }
        
        const currency = this.currencyManager.getCurrency(data.currency);
        const years = results.map(r => r.year.toString());
        const salaries = results.map(r => r.salary);
        const bonuses = results.map(r => r.bonus);
        const totalIncomes = results.map(r => r.totalIncome);
        const realValues = results.map(r => r.realValue);
        
        // Визначення поточної теми для стилізації графіка
        const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
        const textColor = isDark ? '#cbd5e1' : '#4a1f12';
        const titleColor = isDark ? '#f8fafc' : '#1f0b02';
        const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.06)';
        const tooltipBg = isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.95)';
        const tooltipTitle = isDark ? '#f8fafc' : '#1f0b02';
        const tooltipBody = isDark ? '#cbd5e1' : '#4a1f12';
        const tooltipBorder = isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(255, 126, 95, 0.2)';
        
        this.salaryChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: years,
                datasets: [
                    {
                        label: `Значення Зарплати (${currency.symbol})`,
                        data: salaries,
                        borderColor: '#ff7e5f',
                        backgroundColor: 'rgba(255, 126, 95, 0.15)',
                        borderWidth: 3,
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: `Значення Премії (${currency.symbol})`,
                        data: bonuses,
                        borderColor: '#cc2b00',
                        backgroundColor: 'rgba(204, 43, 0, 0.1)',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.4
                    },
                    {
                        label: `Загальний дохід (${currency.symbol})`,
                        data: totalIncomes,
                        borderColor: '#ffb347',
                        backgroundColor: 'rgba(255, 179, 71, 0.1)',
                        borderWidth: 2,
                        fill: false,
                        tension: 0.4
                    },
                    {
                        label: `Реальна вартість (після інфляції)`,
                        data: realValues,
                        borderColor: '#ffdd55',
                        backgroundColor: 'transparent',
                        borderWidth: 2,
                        borderDash: [5, 5],
                        fill: false,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: `Прогноз росту доходу (${data.taxType === 'gross' ? 'Брудними (Gross)' : 'Чистими на руки (Net)'})`,
                        font: { size: 16, weight: 'bold', family: "'Inter', sans-serif" },
                        color: titleColor,
                        padding: { bottom: 15 }
                    },
                    legend: {
                        position: 'top',
                        labels: { 
                            usePointStyle: true, 
                            padding: 18,
                            color: textColor,
                            font: { family: "'Inter', sans-serif", weight: '500' }
                        }
                    },
                    tooltip: {
                        backgroundColor: tooltipBg,
                        titleColor: tooltipTitle,
                        bodyColor: tooltipBody,
                        borderColor: tooltipBorder,
                        borderWidth: 1,
                        padding: 12,
                        boxPadding: 6,
                        usePointStyle: true,
                        titleFont: { family: "'Inter', sans-serif", weight: 'bold' },
                        bodyFont: { family: "'Inter', sans-serif" }
                    }
                },
                scales: {
                    x: {
                        title: { 
                            display: true, 
                            text: 'Рік',
                            color: textColor,
                            font: { family: "'Inter', sans-serif", weight: '600' }
                        },
                        ticks: {
                            color: textColor,
                            font: { family: "'Inter', sans-serif" }
                        },
                        grid: { color: gridColor }
                    },
                    y: {
                        title: { 
                            display: true, 
                            text: `Сума (${currency.symbol})`,
                            color: textColor,
                            font: { family: "'Inter', sans-serif", weight: '600' }
                        },
                        ticks: {
                            color: textColor,
                            font: { family: "'Inter', sans-serif" },
                            callback: (value) => this.formatCurrency(value, currency, true)
                        },
                        grid: { color: gridColor }
                    }
                },
                interaction: { intersect: false, mode: 'index' },
                elements: { point: { radius: 4, hoverRadius: 6 } }
            }
        });
    }

    addTooltips() {
        const tooltips = {
            'taxType': 'Система оподаткування для перерахунку доходу "на руки"',
            'currentSalary': 'Введіть вашу поточну зарплату до вирахування податків (Gross)',
            'experienceYears': 'Скільки років ви працюєте в цій сфері',
            'annualGrowth': 'Очікуваний річний ріст зарплати у відсотках',
            'projectionYears': 'На скільки років вперед робити прогноз',
            'bonusPercentage': 'Відсоток премії від зарплати (Gross)'
        };
        
        Object.keys(tooltips).forEach(id => {
            const element = document.getElementById(id);
            if (element) {
                element.title = tooltips[id];
            }
        });
    }
}

// Additional Global functions
function exportToCSV() {
    const table = document.getElementById('projectionTable');
    if (!table) return;
    const rows = Array.from(table.querySelectorAll('tr'));
    if (rows.length === 0) return;
    
    // UTF-8 BOM (\uFEFF) для коректного відображення кирилиці в MS Excel та Google Sheets
    let csvContent = '\uFEFF' + rows.map(row => 
        Array.from(row.querySelectorAll('th, td'))
            .map(cell => {
                const text = cell.textContent.trim().replace(/\s+/g, ' ');
                return `"${text.replace(/"/g, '""')}"`;
            })
            .join(';')
    ).join('\r\n');
    
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `salary_projection_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
}

function printResults() {
    window.print();
}

// PDF Export function
function generatePDF() {
    const element = document.getElementById('resultsSection');
    if (!element) return;

    const opt = {
        margin:       0.5,
        filename:     `salary_projection_${new Date().toISOString().slice(0, 10)}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2 },
        jsPDF:        { unit: 'in', format: 'letter', orientation: 'portrait' }
    };
    
    // Приховуємо панель кнопок під час формування PDF
    const actionsPanel = element.querySelector('.actions-panel');
    if (actionsPanel) actionsPanel.style.display = 'none';

    html2pdf().set(opt).from(element).save().then(() => {
        if (actionsPanel) actionsPanel.style.display = 'flex';
    }).catch(err => {
        console.error('PDF export error:', err);
        if (actionsPanel) actionsPanel.style.display = 'flex';
    });
}

// Initialize application
document.addEventListener('DOMContentLoaded', () => {
    window.app = new App();
    
    // Attach Export Actions
    const downloadPdfBtn = document.getElementById('downloadPdfBtn');
    if (downloadPdfBtn) {
        downloadPdfBtn.addEventListener('click', generatePDF);
    }
    
    const downloadCsvBtn = document.getElementById('downloadCsvBtn');
    if (downloadCsvBtn) {
        downloadCsvBtn.addEventListener('click', exportToCSV);
    }

    const printBtn = document.getElementById('printBtn');
    if (printBtn) {
        printBtn.addEventListener('click', printResults);
    }
    
    // Web App (PWA) ServiceWorker Registration
    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('./sw.js')
                .then(registration => {
                    console.log('ServiceWorker registration successful with scope: ', registration.scope);
                })
                .catch(error => {
                    console.log('ServiceWorker registration failed: ', error);
                });
        });
    }
});
