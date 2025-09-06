// Currency symbols and exchange rates (approximate)
const CURRENCIES = {
    UAH: { symbol: '₴', name: 'Гривня', rate: 1 },
    EUR: { symbol: '€', name: 'Євро', rate: 0.025 },
    USD: { symbol: '$', name: 'Долар США', rate: 0.027 }
};

// Salary categories with typical ranges (in UAH)
const SALARY_CATEGORIES = {
    minimum: { 
        name: 'Мінімальна зарплата', 
        min: 6000, 
        max: 12000,
        description: 'Початковий рівень, стажер'
    },
    average: { 
        name: 'Середня зарплата', 
        min: 15000, 
        max: 35000,
        description: 'Досвідчений спеціаліст'
    },
    high: { 
        name: 'Висока зарплата', 
        min: 40000, 
        max: 100000,
        description: 'Старший спеціаліст, керівник'
    }
};

// Global variables
let salaryChart = null;
let currentCurrency = 'UAH';

// DOM elements
const form = document.getElementById('salaryForm');
const resultsSection = document.getElementById('resultsSection');
const currencySelect = document.getElementById('currency');
const salaryCategorySelect = document.getElementById('salaryCategory');
const currentSalaryInput = document.getElementById('currentSalary');

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeForm();
    setupEventListeners();
    updateSalarySuggestions();
});

function initializeForm() {
    // Set default values based on current date
    const currentYear = new Date().getFullYear();
    
    // Add some sample data for demonstration
    currentSalaryInput.placeholder = 'Наприклад: 25000';
}

function setupEventListeners() {
    form.addEventListener('submit', handleFormSubmit);
    currencySelect.addEventListener('change', handleCurrencyChange);
    salaryCategorySelect.addEventListener('change', updateSalarySuggestions);
    currentSalaryInput.addEventListener('input', validateSalaryInput);
}

function handleCurrencyChange() {
    currentCurrency = currencySelect.value;
    updateSalarySuggestions();
    
    // Update existing results if they exist
    if (resultsSection.style.display !== 'none') {
        const formData = getFormData();
        calculateAndDisplayResults(formData);
    }
}

function updateSalarySuggestions() {
    const category = salaryCategorySelect.value;
    const categoryData = SALARY_CATEGORIES[category];
    const currency = CURRENCIES[currentCurrency];
    
    // Convert to selected currency
    const minInCurrency = Math.round(categoryData.min * currency.rate);
    const maxInCurrency = Math.round(categoryData.max * currency.rate);
    
    currentSalaryInput.placeholder = `${categoryData.description} (${minInCurrency} - ${maxInCurrency} ${currency.symbol})`;
    currentSalaryInput.min = minInCurrency;
    currentSalaryInput.max = maxInCurrency;
}

function validateSalaryInput() {
    const value = parseFloat(currentSalaryInput.value);
    const category = salaryCategorySelect.value;
    const categoryData = SALARY_CATEGORIES[category];
    const currency = CURRENCIES[currentCurrency];
    
    const minInCurrency = categoryData.min * currency.rate;
    const maxInCurrency = categoryData.max * currency.rate;
    
    if (value < minInCurrency) {
        currentSalaryInput.setCustomValidity(`Мінімальна зарплата для цієї категорії: ${minInCurrency} ${currency.symbol}`);
    } else if (value > maxInCurrency) {
        currentSalaryInput.setCustomValidity(`Максимальна зарплата для цієї категорії: ${maxInCurrency} ${currency.symbol}`);
    } else {
        currentSalaryInput.setCustomValidity('');
    }
}

function handleFormSubmit(event) {
    event.preventDefault();
    
    const formData = getFormData();
    if (validateFormData(formData)) {
        calculateAndDisplayResults(formData);
    }
}

function getFormData() {
    return {
        currency: currencySelect.value,
        salaryCategory: salaryCategorySelect.value,
        currentSalary: parseFloat(currentSalaryInput.value),
        experienceYears: parseInt(document.getElementById('experienceYears').value),
        annualGrowth: parseFloat(document.getElementById('annualGrowth').value),
        projectionYears: parseInt(document.getElementById('projectionYears').value),
        bonusPercentage: parseFloat(document.getElementById('bonusPercentage').value) || 0
    };
}

function validateFormData(data) {
    if (data.currentSalary <= 0) {
        alert('Будь ласка, введіть коректну зарплату');
        return false;
    }
    
    if (data.experienceYears < 0 || data.experienceYears > 50) {
        alert('Роки досвіду повинні бути від 0 до 50');
        return false;
    }
    
    if (data.annualGrowth < 0 || data.annualGrowth > 100) {
        alert('Річний ріст повинен бути від 0 до 100%');
        return false;
    }
    
    if (data.projectionYears < 1 || data.projectionYears > 20) {
        alert('Років для прогнозу повинно бути від 1 до 20');
        return false;
    }
    
    return true;
}

function calculateAndDisplayResults(data) {
    const results = calculateSalaryProjection(data);
    displayResults(results, data);
    createChart(results, data);
}

function calculateSalaryProjection(data) {
    const results = [];
    let currentSalary = data.currentSalary;
    const annualGrowthRate = data.annualGrowth / 100;
    const bonusRate = data.bonusPercentage / 100;
    
    for (let year = 0; year <= data.projectionYears; year++) {
        const yearNumber = new Date().getFullYear() + year;
        const bonus = currentSalary * bonusRate;
        const totalIncome = currentSalary + bonus;
        
        results.push({
            year: yearNumber,
            salary: currentSalary,
            bonus: bonus,
            totalIncome: totalIncome,
            growthFromPrevious: year === 0 ? 0 : ((currentSalary - results[year - 1].salary) / results[year - 1].salary * 100)
        });
        
        // Calculate salary for next year
        if (year < data.projectionYears) {
            currentSalary = currentSalary * (1 + annualGrowthRate);
        }
    }
    
    return results;
}

function displayResults(results, data) {
    const currency = CURRENCIES[data.currency];
    
    // Update summary cards
    document.getElementById('currentSalaryDisplay').textContent = 
        formatCurrency(results[0].salary, currency);
    
    document.getElementById('projectedSalaryDisplay').textContent = 
        formatCurrency(results[results.length - 1].salary, currency);
    
    const totalGrowth = ((results[results.length - 1].salary - results[0].salary) / results[0].salary * 100);
    document.getElementById('totalGrowthDisplay').textContent = 
        `${totalGrowth.toFixed(1)}%`;
    
    const totalBonus = results.reduce((sum, result) => sum + result.bonus, 0);
    document.getElementById('totalBonusDisplay').textContent = 
        formatCurrency(totalBonus, currency);
    
    // Update projection table
    updateProjectionTable(results, currency);
    
    // Show results section
    resultsSection.style.display = 'block';
    resultsSection.scrollIntoView({ behavior: 'smooth' });
}

function updateProjectionTable(results, currency) {
    const tbody = document.getElementById('projectionTableBody');
    tbody.innerHTML = '';
    
    results.forEach((result, index) => {
        const row = document.createElement('tr');
        
        const growthClass = result.growthFromPrevious > 0 ? 'positive' : 
                           result.growthFromPrevious < 0 ? 'negative' : '';
        
        row.innerHTML = `
            <td>${result.year}</td>
            <td>${formatCurrency(result.salary, currency)}</td>
            <td>${formatCurrency(result.bonus, currency)}</td>
            <td><strong>${formatCurrency(result.totalIncome, currency)}</strong></td>
            <td class="${growthClass}">
                ${result.growthFromPrevious > 0 ? '+' : ''}${result.growthFromPrevious.toFixed(1)}%
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

function createChart(results, data) {
    const ctx = document.getElementById('salaryChart').getContext('2d');
    
    // Destroy existing chart if it exists
    if (salaryChart) {
        salaryChart.destroy();
    }
    
    const currency = CURRENCIES[data.currency];
    const years = results.map(r => r.year.toString());
    const salaries = results.map(r => r.salary);
    const bonuses = results.map(r => r.bonus);
    const totalIncomes = results.map(r => r.totalIncome);
    
    salaryChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: years,
            datasets: [
                {
                    label: `Зарплата (${currency.symbol})`,
                    data: salaries,
                    borderColor: '#667eea',
                    backgroundColor: 'rgba(102, 126, 234, 0.1)',
                    borderWidth: 3,
                    fill: true,
                    tension: 0.4
                },
                {
                    label: `Премія (${currency.symbol})`,
                    data: bonuses,
                    borderColor: '#764ba2',
                    backgroundColor: 'rgba(118, 75, 162, 0.1)',
                    borderWidth: 2,
                    fill: false,
                    tension: 0.4
                },
                {
                    label: `Загальний дохід (${currency.symbol})`,
                    data: totalIncomes,
                    borderColor: '#48bb78',
                    backgroundColor: 'rgba(72, 187, 120, 0.1)',
                    borderWidth: 2,
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
                    text: 'Прогноз росту зарплати',
                    font: {
                        size: 16,
                        weight: 'bold'
                    }
                },
                legend: {
                    position: 'top',
                    labels: {
                        usePointStyle: true,
                        padding: 20
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Рік'
                    },
                    grid: {
                        color: 'rgba(0,0,0,0.1)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: `Сума (${currency.symbol})`
                    },
                    grid: {
                        color: 'rgba(0,0,0,0.1)'
                    },
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value, currency, true);
                        }
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index'
            },
            elements: {
                point: {
                    radius: 4,
                    hoverRadius: 6
                }
            }
        }
    });
}

function formatCurrency(amount, currency, short = false) {
    if (short && amount >= 1000000) {
        return `${(amount / 1000000).toFixed(1)}М ${currency.symbol}`;
    } else if (short && amount >= 1000) {
        return `${(amount / 1000).toFixed(1)}К ${currency.symbol}`;
    }
    
    return `${Math.round(amount).toLocaleString()} ${currency.symbol}`;
}

// Utility functions for additional features
function exportToCSV() {
    const table = document.getElementById('projectionTable');
    const rows = Array.from(table.querySelectorAll('tr'));
    
    let csv = rows.map(row => 
        Array.from(row.querySelectorAll('th, td'))
            .map(cell => cell.textContent.trim())
            .join(',')
    ).join('\n');
    
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'salary_projection.csv';
    a.click();
    window.URL.revokeObjectURL(url);
}

function printResults() {
    const printWindow = window.open('', '_blank');
    const resultsContent = document.getElementById('resultsSection').innerHTML;
    
    printWindow.document.write(`
        <html>
            <head>
                <title>Прогноз зарплати</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
                    th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
                    th { background-color: #f2f2f2; }
                    .card { border: 1px solid #ddd; padding: 15px; margin: 10px 0; }
                </style>
            </head>
            <body>
                <h1>Прогноз зарплати</h1>
                ${resultsContent}
            </body>
        </html>
    `);
    
    printWindow.document.close();
    printWindow.print();
}

// Add some sample data functionality
function loadSampleData() {
    document.getElementById('currentSalary').value = '25000';
    document.getElementById('experienceYears').value = '3';
    document.getElementById('annualGrowth').value = '8';
    document.getElementById('projectionYears').value = '5';
    document.getElementById('bonusPercentage').value = '15';
    
    updateSalarySuggestions();
}

// Add keyboard shortcuts
document.addEventListener('keydown', function(event) {
    if (event.ctrlKey && event.key === 'Enter') {
        form.dispatchEvent(new Event('submit'));
    }
});

// Add tooltips for better UX
function addTooltips() {
    const tooltips = {
        'currentSalary': 'Введіть вашу поточну зарплату',
        'experienceYears': 'Скільки років ви працюєте в цій сфері',
        'annualGrowth': 'Очікуваний річний ріст зарплати у відсотках',
        'projectionYears': 'На скільки років вперед робити прогноз',
        'bonusPercentage': 'Відсоток премії від зарплати'
    };
    
    Object.keys(tooltips).forEach(id => {
        const element = document.getElementById(id);
        if (element) {
            element.title = tooltips[id];
        }
    });
}

// Initialize tooltips when DOM is loaded
document.addEventListener('DOMContentLoaded', addTooltips);
