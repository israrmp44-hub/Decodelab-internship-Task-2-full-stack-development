/* =========================================================
   SMARTFIX - SERVICE & REPAIR MANAGEMENT SYSTEM
   Frontend Application Script
   Clean, simple, modular, and fully connected to FastAPI
   ========================================================= */

// Backend API base URL
const API_BASE_URL = "http://127.0.0.1:8000/api/v1";

document.addEventListener("DOMContentLoaded", () => {

    /* =====================================================
       1. SETTINGS & APP STATE
       ===================================================== */

    let currentSettings = {
        theme: "light",
        accent: "#263b55",
        currency: "PKR",
        prefix: "SF"
    };

    function loadSettings() {
        try {
            const saved = JSON.parse(localStorage.getItem("smartfix-settings") || "{}");
            currentSettings = { ...currentSettings, ...saved };
        } catch (e) {
            console.warn("Could not parse saved settings:", e);
        }

        // Apply theme and accent
        document.body.classList.toggle("dark-theme", currentSettings.theme === "dark");
        document.documentElement.style.setProperty("--accent", currentSettings.accent || "#263b55");

        // Populate settings fields in UI
        const themeSelect = document.getElementById("theme-select");
        if (themeSelect) themeSelect.value = currentSettings.theme;

        const accentColor = document.getElementById("accent-color");
        if (accentColor) accentColor.value = currentSettings.accent;

        const currencySelect = document.getElementById("currency-select");
        if (currencySelect) currencySelect.value = currentSettings.currency;

        const repairPrefix = document.getElementById("repair-prefix");
        if (repairPrefix) repairPrefix.value = currentSettings.prefix;

        // Update all currency labels across the UI
        document.querySelectorAll(".currency-label").forEach((el) => {
            el.textContent = currentSettings.currency;
        });
    }

    function saveSettings() {
        const themeSelect = document.getElementById("theme-select");
        const accentColor = document.getElementById("accent-color");
        const currencySelect = document.getElementById("currency-select");
        const repairPrefix = document.getElementById("repair-prefix");

        if (themeSelect) currentSettings.theme = themeSelect.value;
        if (accentColor) currentSettings.accent = accentColor.value;
        if (currencySelect) currentSettings.currency = currencySelect.value;
        if (repairPrefix) currentSettings.prefix = repairPrefix.value.trim() || "SF";

        localStorage.setItem("smartfix-settings", JSON.stringify(currentSettings));
        loadSettings();

        // Refresh currently active page data with new currency/prefix
        const activePage = document.querySelector(".page.active");
        if (activePage) {
            refreshPage(activePage.id);
        }

        alert("Settings saved successfully!");
    }

    const saveSettingsBtn = document.getElementById("save-settings-btn");
    if (saveSettingsBtn) saveSettingsBtn.addEventListener("click", saveSettings);

    const themeSelect = document.getElementById("theme-select");
    if (themeSelect) {
        themeSelect.addEventListener("change", () => {
            currentSettings.theme = themeSelect.value;
            document.body.classList.toggle("dark-theme", currentSettings.theme === "dark");
        });
    }

    const accentColor = document.getElementById("accent-color");
    if (accentColor) {
        accentColor.addEventListener("input", () => {
            document.documentElement.style.setProperty("--accent", accentColor.value);
        });
    }

    // Helper: Format Money
    function formatMoney(amount) {
        const num = Number(amount) || 0;
        return `${currentSettings.currency} ${num.toLocaleString()}`;
    }

    // Helper: Format Repair ID
    function formatRepairId(id) {
        const prefix = currentSettings.prefix || "SF";
        const padded = String(id).padStart(3, "0");
        return `${prefix}-${padded}`;
    }

    // Helper: Status Badge Class
    function getStatusClass(status) {
        switch ((status || "").toLowerCase()) {
            case "received": return "received";
            case "in progress": return "in-progress";
            case "on hold": return "on-hold";
            case "completed": return "completed";
            case "delivered": return "delivered";
            case "cancelled": return "cancelled";
            default: return "received";
        }
    }

    /* =====================================================
       2. PAGE NAVIGATION
       ===================================================== */

    const navItems = document.querySelectorAll(".nav-item");
    const pages = document.querySelectorAll(".page");

    function refreshPage(pageId) {
        if (pageId === "dashboard") loadDashboard();
        if (pageId === "repairs") loadRepairs();
        if (pageId === "new-repair") populateCustomerSelect();
        if (pageId === "customers") loadCustomers();
        if (pageId === "reports") loadReports();
    }

    function showPage(pageId) {
        const targetPage = document.getElementById(pageId);
        if (!targetPage) return;

        pages.forEach((p) => p.classList.remove("active"));
        navItems.forEach((n) => n.classList.remove("active"));

        targetPage.classList.add("active");

        const matchingNav = document.querySelector(`.nav-item[data-page="${pageId}"]`);
        if (matchingNav) matchingNav.classList.add("active");

        refreshPage(pageId);
    }

    navItems.forEach((item) => {
        item.addEventListener("click", () => showPage(item.dataset.page));
    });

    document.querySelectorAll("[data-page]").forEach((btn) => {
        if (!btn.classList.contains("nav-item")) {
            btn.addEventListener("click", () => showPage(btn.dataset.page));
        }
    });

    /* =====================================================
       3. DASHBOARD MODULE
       ===================================================== */

    async function loadDashboard() {
        try {
            // 1. Load Live Shop Statistics
            const statsRes = await fetch(`${API_BASE_URL}/stats/`);
            if (statsRes.ok) {
                const stats = await statsRes.json();
                const totalRepairsEl = document.getElementById("dash-total-repairs");
                const inProgressEl = document.getElementById("dash-in-progress");
                const completedEl = document.getElementById("dash-completed");
                const pendingPaymentEl = document.getElementById("dash-pending-payment");

                if (totalRepairsEl) totalRepairsEl.textContent = stats.total_repairs;
                if (inProgressEl) inProgressEl.textContent = stats.in_progress;
                if (completedEl) completedEl.textContent = stats.completed;
                if (pendingPaymentEl) pendingPaymentEl.textContent = formatMoney(stats.pending_amount);
            }

            // 2. Load Recent Repairs (Latest 5)
            const repairsRes = await fetch(`${API_BASE_URL}/repairs/`);
            const tbody = document.getElementById("dashboard-recent-repairs-body");
            if (!tbody) return;

            if (!repairsRes.ok) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: var(--text-muted);">Failed to load recent repairs.</td></tr>`;
                return;
            }

            const data = await repairsRes.json();
            const repairs = (data.repairs || []).slice(0, 5);
            tbody.replaceChildren();

            if (repairs.length === 0) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color: var(--text-muted);">No repairs registered yet. Click "+ New Repair" to get started.</td></tr>`;
                return;
            }

            repairs.forEach((repair) => {
                const tr = document.createElement("tr");
                const cost = repair.final_cost !== null && repair.final_cost !== undefined ? repair.final_cost : repair.estimated_cost;

                tr.innerHTML = `
                    <td><strong>${formatRepairId(repair.id)}</strong></td>
                    <td>${escapeHtml(repair.customer_name)}<br><small style="color:var(--text-muted);">${escapeHtml(repair.customer_phone)}</small></td>
                    <td>${escapeHtml(repair.brand)} ${escapeHtml(repair.model)}</td>
                    <td>${escapeHtml(repair.issue)}</td>
                    <td><span class="status ${getStatusClass(repair.status)}">${escapeHtml(repair.status)}</span></td>
                    <td>${formatMoney(repair.total_paid || 0)} / ${formatMoney(cost)}</td>
                `;
                tbody.appendChild(tr);
            });
        } catch (err) {
            console.error("Dashboard loading error:", err);
            const tbody = document.getElementById("dashboard-recent-repairs-body");
            if (tbody) {
                tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:#dc2626;">Cannot connect to backend API (${API_BASE_URL}). Make sure FastAPI server is running.</td></tr>`;
            }
        }
    }

    /* =====================================================
       4. REPAIRS MANAGEMENT MODULE
       ===================================================== */

    const repairsTableBody = document.getElementById("repairs-table-body");
    const repairSearch = document.getElementById("repair-search");
    const repairStatusFilter = document.getElementById("repair-status-filter");

    let allRepairsCache = [];

    async function loadRepairs() {
        if (!repairsTableBody) return;

        try {
            const statusFilter = repairStatusFilter ? repairStatusFilter.value : "all";
            const searchVal = repairSearch ? repairSearch.value.trim() : "";

            let url = `${API_BASE_URL}/repairs/?`;
            if (statusFilter && statusFilter !== "all") url += `status_filter=${encodeURIComponent(statusFilter)}&`;
            if (searchVal) url += `search=${encodeURIComponent(searchVal)}&`;

            const res = await fetch(url);
            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data.detail || `HTTP ${res.status}`);
            }

            allRepairsCache = data.repairs || [];
            renderRepairsTable(allRepairsCache);
        } catch (err) {
            console.error("Error loading repairs:", err);
            repairsTableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align:center; color:#dc2626;">
                        Could not load repairs. Make sure FastAPI backend is running at ${API_BASE_URL}.
                    </td>
                </tr>
            `;
        }
    }

    function renderRepairsTable(repairs) {
        if (!repairsTableBody) return;
        repairsTableBody.replaceChildren();

        if (repairs.length === 0) {
            repairsTableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align:center; color: var(--text-muted); padding: 25px;">
                        No repair jobs found. Click "+ New Repair" to register one.
                    </td>
                </tr>
            `;
            return;
        }

        repairs.forEach((repair) => {
            const tr = document.createElement("tr");
            const billedCost = repair.final_cost !== null && repair.final_cost !== undefined ? repair.final_cost : repair.estimated_cost;
            const paid = repair.total_paid || 0;
            const balance = Math.max(0, billedCost - paid);

            tr.innerHTML = `
                <td><strong>${formatRepairId(repair.id)}</strong></td>
                <td>
                    <strong>${escapeHtml(repair.customer_name)}</strong><br>
                    <small style="color:var(--text-muted);">${escapeHtml(repair.customer_phone)}</small>
                </td>
                <td>
                    <strong>${escapeHtml(repair.brand)} ${escapeHtml(repair.model)}</strong><br>
                    <small style="color:var(--text-muted);">${escapeHtml(repair.device_type)}</small>
                </td>
                <td style="max-width: 200px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${escapeHtml(repair.issue)}">
                    ${escapeHtml(repair.issue)}
                </td>
                <td>
                    <span class="status ${getStatusClass(repair.status)}">${escapeHtml(repair.status)}</span>
                </td>
                <td>
                    <strong>${formatMoney(billedCost)}</strong><br>
                    <small style="color: ${balance === 0 ? 'var(--success, #16865b)' : 'var(--warning, #b7791f)'};">
                        Paid: ${formatMoney(paid)}
                    </small>
                </td>
                <td>
                    <div class="action-buttons">
                        <button type="button" class="btn-sm btn-status" data-repair-id="${repair.id}" title="Update repair status">
                            Status
                        </button>
                        <button type="button" class="btn-sm btn-primary-sm btn-payment" data-repair-id="${repair.id}" title="Record or view payments">
                            Payment
                        </button>
                        <button type="button" class="btn-sm btn-danger-sm btn-delete-repair" data-repair-id="${repair.id}" title="Delete repair">
                            Delete
                        </button>
                    </div>
                </td>
            `;

            // Attach event listeners to action buttons
            const statusBtn = tr.querySelector(".btn-status");
            if (statusBtn) {
                statusBtn.addEventListener("click", () => openStatusModal(repair));
            }

            const paymentBtn = tr.querySelector(".btn-payment");
            if (paymentBtn) {
                paymentBtn.addEventListener("click", () => openPaymentModal(repair.id));
            }

            const deleteBtn = tr.querySelector(".btn-delete-repair");
            if (deleteBtn) {
                deleteBtn.addEventListener("click", () => deleteRepair(repair.id));
            }

            repairsTableBody.appendChild(tr);
        });
    }

    if (repairSearch) {
        repairSearch.addEventListener("input", debounce(loadRepairs, 300));
    }
    if (repairStatusFilter) {
        repairStatusFilter.addEventListener("change", loadRepairs);
    }

    async function deleteRepair(repairId) {
        if (!confirm(`Are you sure you want to delete repair ${formatRepairId(repairId)}?`)) {
            return;
        }

        try {
            const res = await fetch(`${API_BASE_URL}/repairs/${repairId}`, {
                method: "DELETE"
            });
            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data.detail || `Cannot delete repair (HTTP ${res.status}).`);
            }

            alert("Repair deleted successfully.");
            loadRepairs();
            loadDashboard();
        } catch (err) {
            console.error("Delete repair error:", err);
            alert(err.message || "Failed to delete repair.");
        }
    }

    /* =====================================================
       5. NEW REPAIR CREATION MODULE
       ===================================================== */

    const newRepairForm = document.getElementById("new-repair-form");
    const existingCustomerSelect = document.getElementById("select-existing-customer");
    const customerNameInput = document.getElementById("customer-name");
    const customerPhoneInput = document.getElementById("customer-phone");
    const customerEmailInput = document.getElementById("customer-email");
    const repairMessage = document.getElementById("repair-form-message");

    // Populate existing customer dropdown
    async function populateCustomerSelect() {
        if (!existingCustomerSelect) return;

        try {
            const res = await fetch(`${API_BASE_URL}/customers/`);
            if (!res.ok) return;

            const data = await res.json();
            const customers = data.customers || [];

            existingCustomerSelect.replaceChildren();

            const defaultOpt = document.createElement("option");
            defaultOpt.value = "";
            defaultOpt.textContent = "-- Or enter new customer details below --";
            existingCustomerSelect.appendChild(defaultOpt);

            customers.forEach((c) => {
                const opt = document.createElement("option");
                opt.value = c.id;
                opt.textContent = `${c.name} (${c.phone})`;
                opt.dataset.name = c.name;
                opt.dataset.phone = c.phone;
                opt.dataset.email = c.email || "";
                existingCustomerSelect.appendChild(opt);
            });
        } catch (e) {
            console.warn("Could not load customer options:", e);
        }
    }

    if (existingCustomerSelect) {
        existingCustomerSelect.addEventListener("change", () => {
            const selectedOpt = existingCustomerSelect.options[existingCustomerSelect.selectedIndex];
            if (selectedOpt && selectedOpt.value) {
                if (customerNameInput) customerNameInput.value = selectedOpt.dataset.name || "";
                if (customerPhoneInput) customerPhoneInput.value = selectedOpt.dataset.phone || "";
                if (customerEmailInput) customerEmailInput.value = selectedOpt.dataset.email || "";
            }
        });
    }

    if (newRepairForm) {
        newRepairForm.addEventListener("submit", async (event) => {
            event.preventDefault();

            const name = customerNameInput?.value.trim() || "";
            const phone = customerPhoneInput?.value.trim() || "";
            const email = customerEmailInput?.value.trim() || "";
            const deviceType = document.getElementById("device-type")?.value || "";
            const brand = document.getElementById("device-brand")?.value.trim() || "";
            const model = document.getElementById("device-model")?.value.trim() || "";
            const issue = document.getElementById("repair-issue")?.value.trim() || "";
            const estimatedCost = Number(document.getElementById("estimated-cost")?.value);
            const submitBtn = document.getElementById("submit-repair-btn");

            if (!name || !phone || !deviceType || !brand || !model || !issue || isNaN(estimatedCost) || estimatedCost < 0) {
                if (repairMessage) {
                    repairMessage.textContent = "Please fill in all required fields with valid information.";
                    repairMessage.style.color = "#dc2626";
                }
                return;
            }

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = "Creating...";
            }
            if (repairMessage) {
                repairMessage.textContent = "Saving customer and creating repair job in database...";
                repairMessage.style.color = "#64748b";
            }

            try {
                // Step A: Find or Create Customer
                let customerId = null;

                // Check by exact phone
                const searchRes = await fetch(`${API_BASE_URL}/customers/?phone=${encodeURIComponent(phone)}`);
                if (searchRes.ok) {
                    const searchData = await searchRes.json();
                    if (searchData.customers && searchData.customers.length > 0) {
                        customerId = searchData.customers[0].id;
                    }
                }

                // If customer does not exist, create new customer
                if (!customerId) {
                    const createCustRes = await fetch(`${API_BASE_URL}/customers/`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                            name: name,
                            phone: phone,
                            email: email || null
                        })
                    });

                    const custData = await createCustRes.json().catch(() => ({}));

                    if (!createCustRes.ok) {
                        throw new Error(custData.detail || "Could not create customer record.");
                    }

                    customerId = custData.customer.id;
                }

                // Step B: Create Repair Job
                const repairRes = await fetch(`${API_BASE_URL}/repairs/`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        customer_id: customerId,
                        device_type: deviceType,
                        brand: brand,
                        model: model,
                        issue: issue,
                        estimated_cost: Math.round(estimatedCost)
                    })
                });

                const repairData = await repairRes.json().catch(() => ({}));

                if (!repairRes.ok) {
                    throw new Error(repairData.detail || "Could not create repair job.");
                }

                const createdId = repairData.repair.id;
                const formattedId = formatRepairId(createdId);

                if (repairMessage) {
                    repairMessage.textContent = `Repair job ${formattedId} created successfully for ${name}!`;
                    repairMessage.style.color = "#15803d";
                }

                newRepairForm.reset();
                populateCustomerSelect();

                // Wait 1.5 seconds and take the user to the Repairs page
                setTimeout(() => {
                    showPage("repairs");
                }, 1200);

            } catch (err) {
                console.error("Repair creation error:", err);
                if (repairMessage) {
                    repairMessage.textContent = err.message || "Failed to create repair.";
                    repairMessage.style.color = "#dc2626";
                }
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = "Create Repair";
                }
            }
        });
    }

    /* =====================================================
       6. CUSTOMERS MANAGEMENT MODULE
       ===================================================== */

    const customerSearch = document.getElementById("customer-search");
    const customersTableBody = document.getElementById("customers-table-body");
    const addCustomerBtn = document.getElementById("add-customer-btn");
    const customerFormContainer = document.getElementById("customer-form-container");
    const closeCustomerForm = document.getElementById("close-customer-form");
    const addCustomerForm = document.getElementById("add-customer-form");
    const customerMessage = document.getElementById("customer-form-message");

    async function loadCustomers() {
        if (!customersTableBody) return;

        try {
            const searchVal = customerSearch ? customerSearch.value.trim() : "";
            let url = `${API_BASE_URL}/customers/`;
            if (searchVal) url += `?search=${encodeURIComponent(searchVal)}`;

            const res = await fetch(url);
            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data.detail || `HTTP ${res.status}`);
            }

            const customers = data.customers || [];
            customersTableBody.replaceChildren();

            if (customers.length === 0) {
                customersTableBody.innerHTML = `
                    <tr>
                        <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 25px;">
                            No customers found. Click "+ Add Customer" above to create one.
                        </td>
                    </tr>
                `;
                return;
            }

            customers.forEach((c) => {
                const tr = document.createElement("tr");

                tr.innerHTML = `
                    <td><strong>CUS-${c.id}</strong></td>
                    <td><strong>${escapeHtml(c.name)}</strong></td>
                    <td>${escapeHtml(c.phone)}</td>
                    <td>${escapeHtml(c.email || "—")}</td>
                    <td><span class="status ${c.total_repairs > 0 ? 'completed' : 'received'}">${c.total_repairs || 0} repairs</span></td>
                    <td>
                        <div class="action-buttons">
                            <button type="button" class="btn-sm btn-view-cust" data-cust-id="${c.id}">
                                View
                            </button>
                            <button type="button" class="btn-sm btn-danger-sm btn-delete-cust" data-cust-id="${c.id}">
                                Delete
                            </button>
                        </div>
                    </td>
                `;

                const viewBtn = tr.querySelector(".btn-view-cust");
                if (viewBtn) {
                    viewBtn.addEventListener("click", () => openCustomerModal(c.id));
                }

                const deleteBtn = tr.querySelector(".btn-delete-cust");
                if (deleteBtn) {
                    deleteBtn.addEventListener("click", () => deleteCustomer(c.id, c.name));
                }

                customersTableBody.appendChild(tr);
            });
        } catch (err) {
            console.error("Load customers error:", err);
            customersTableBody.innerHTML = `
                <tr>
                    <td colspan="6" style="text-align: center; color: #dc2626;">
                        Could not connect to backend server. Make sure FastAPI is running.
                    </td>
                </tr>
            `;
        }
    }

    if (customerSearch) {
        customerSearch.addEventListener("input", debounce(loadCustomers, 300));
    }

    if (addCustomerBtn && customerFormContainer) {
        addCustomerBtn.addEventListener("click", () => {
            customerFormContainer.hidden = false;
            customerFormContainer.scrollIntoView({ behavior: "smooth", block: "start" });
        });
    }

    if (closeCustomerForm && customerFormContainer && addCustomerForm) {
        closeCustomerForm.addEventListener("click", () => {
            customerFormContainer.hidden = true;
            addCustomerForm.reset();
            if (customerMessage) customerMessage.textContent = "";
        });
    }

    if (addCustomerForm) {
        addCustomerForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const name = document.getElementById("new-customer-name")?.value.trim() || "";
            const phone = document.getElementById("new-customer-phone")?.value.trim() || "";
            const email = document.getElementById("new-customer-email")?.value.trim() || "";
            const submitBtn = addCustomerForm.querySelector('button[type="submit"]');

            if (!name || !phone) {
                if (customerMessage) {
                    customerMessage.textContent = "Customer name and phone number are required.";
                    customerMessage.style.color = "#dc2626";
                }
                return;
            }

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = "Saving...";
            }

            try {
                const res = await fetch(`${API_BASE_URL}/customers/`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        name: name,
                        phone: phone,
                        email: email || null
                    })
                });

                const data = await res.json().catch(() => ({}));

                if (!res.ok) {
                    throw new Error(data.detail || "Could not save customer.");
                }

                if (customerMessage) {
                    customerMessage.textContent = "Customer added successfully!";
                    customerMessage.style.color = "#15803d";
                }

                addCustomerForm.reset();
                loadCustomers();
                populateCustomerSelect();

                setTimeout(() => {
                    if (customerFormContainer) customerFormContainer.hidden = true;
                    if (customerMessage) customerMessage.textContent = "";
                }, 1200);

            } catch (err) {
                console.error("Create customer error:", err);
                if (customerMessage) {
                    customerMessage.textContent = err.message || "Failed to save customer.";
                    customerMessage.style.color = "#dc2626";
                }
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = "Save Customer";
                }
            }
        });
    }

    async function deleteCustomer(customerId, customerName) {
        if (!confirm(`Are you sure you want to delete customer "${customerName}"?`)) {
            return;
        }

        try {
            const res = await fetch(`${API_BASE_URL}/customers/${customerId}`, {
                method: "DELETE"
            });
            const data = await res.json().catch(() => ({}));

            if (!res.ok) {
                throw new Error(data.detail || `Cannot delete customer (HTTP ${res.status}).`);
            }

            alert("Customer deleted successfully.");
            loadCustomers();
            populateCustomerSelect();
            loadDashboard();
        } catch (err) {
            console.error("Delete customer error:", err);
            alert(err.message || "Failed to delete customer.");
        }
    }

    /* =====================================================
       7. REPORTS & ANALYTICS MODULE
       ===================================================== */

    async function loadReports() {
        try {
            const res = await fetch(`${API_BASE_URL}/stats/`);
            if (!res.ok) throw new Error("Could not load stats");

            const stats = await res.json();

            // Stat Cards
            setText("report-total-repairs", stats.total_repairs);
            setText("report-completed-repairs", stats.completed);
            setText("report-total-revenue", formatMoney(stats.total_revenue));
            setText("report-pending-amount", formatMoney(stats.pending_amount));

            // Repair Summary by Status
            setText("report-count-received", stats.received);
            setText("report-count-in-progress", stats.in_progress);
            setText("report-count-on-hold", stats.on_hold);
            setText("report-count-completed", stats.completed);
            setText("report-count-delivered", stats.delivered);
            setText("report-count-cancelled", stats.cancelled);

            // Payment Summary
            setText("report-sum-received", formatMoney(stats.total_revenue));
            setText("report-sum-pending", formatMoney(stats.pending_amount));
            setText("report-sum-estimated", formatMoney(stats.total_billed));

        } catch (err) {
            console.error("Reports loading error:", err);
        }
    }

    function setText(id, value) {
        const el = document.getElementById(id);
        if (el) el.textContent = String(value);
    }

    const printReportBtn = document.getElementById("print-report-btn");
    if (printReportBtn) {
        printReportBtn.addEventListener("click", () => window.print());
    }

    /* =====================================================
       8. DATA EXPORT (BACKUP)
       ===================================================== */

    const exportBtn = document.getElementById("export-data-btn");
    if (exportBtn) {
        exportBtn.addEventListener("click", async () => {
            try {
                exportBtn.disabled = true;
                exportBtn.textContent = "Exporting Data...";

                const [customersRes, repairsRes, paymentsRes, statsRes] = await Promise.all([
                    fetch(`${API_BASE_URL}/customers/`),
                    fetch(`${API_BASE_URL}/repairs/`),
                    fetch(`${API_BASE_URL}/payments/`),
                    fetch(`${API_BASE_URL}/stats/`)
                ]);

                const backup = {
                    exported_at: new Date().toISOString(),
                    statistics: await statsRes.json(),
                    customers: (await customersRes.json()).customers || [],
                    repairs: (await repairsRes.json()).repairs || [],
                    payments: (await paymentsRes.json()).payments || []
                };

                const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(backup, null, 2));
                const downloadAnchor = document.createElement("a");
                downloadAnchor.setAttribute("href", dataStr);
                downloadAnchor.setAttribute("download", `smartfix_backup_${Date.now()}.json`);
                document.body.appendChild(downloadAnchor);
                downloadAnchor.click();
                downloadAnchor.remove();

                alert("Shop data exported successfully as JSON!");
            } catch (err) {
                console.error("Export error:", err);
                alert("Could not export data: " + err.message);
            } finally {
                exportBtn.disabled = false;
                exportBtn.textContent = "Export Shop Data (JSON)";
            }
        });
    }

    /* =====================================================
       9. MODALS: PAYMENTS, STATUS, CUSTOMER DETAILS
       ===================================================== */

    // --- PAYMENT MODAL ---
    const paymentModal = document.getElementById("payment-modal");
    const closePaymentModalBtn = document.getElementById("close-payment-modal");
    const paymentForm = document.getElementById("record-payment-form");
    const paymentRepairIdInput = document.getElementById("payment-repair-id");
    const paymentModalInfo = document.getElementById("payment-modal-info");
    const paymentHistoryContainer = document.getElementById("payment-history-container");
    const paymentFormMessage = document.getElementById("payment-form-message");

    async function openPaymentModal(repairId) {
        if (!paymentModal) return;
        paymentModal.classList.add("active");
        if (paymentRepairIdInput) paymentRepairIdInput.value = repairId;
        if (paymentFormMessage) paymentFormMessage.textContent = "";

        await loadRepairPaymentDetails(repairId);
    }

    async function loadRepairPaymentDetails(repairId) {
        if (paymentModalInfo) paymentModalInfo.innerHTML = "Loading repair details...";
        if (paymentHistoryContainer) paymentHistoryContainer.innerHTML = "Loading payments...";

        try {
            const [repairRes, paymentsRes] = await Promise.all([
                fetch(`${API_BASE_URL}/repairs/${repairId}`),
                fetch(`${API_BASE_URL}/payments/${repairId}`)
            ]);

            if (!repairRes.ok) throw new Error("Repair not found");

            const repairData = (await repairRes.json()).repair;
            const paymentsData = await paymentsRes.json();

            const billedCost = repairData.final_cost !== null && repairData.final_cost !== undefined ? repairData.final_cost : repairData.estimated_cost;
            const totalPaid = paymentsData.total_paid || 0;
            const balance = Math.max(0, billedCost - totalPaid);

            if (paymentModalInfo) {
                paymentModalInfo.innerHTML = `
                    <p><strong>Repair ID:</strong> ${formatRepairId(repairData.id)} &bull; <strong>Device:</strong> ${escapeHtml(repairData.brand)} ${escapeHtml(repairData.model)}</p>
                    <p><strong>Customer:</strong> ${escapeHtml(repairData.customer_name)} (${escapeHtml(repairData.customer_phone)})</p>
                    <p><strong>Total Billed:</strong> ${formatMoney(billedCost)} &bull; <strong>Paid:</strong> ${formatMoney(totalPaid)} &bull; <strong style="color: ${balance > 0 ? '#b7791f' : '#16865b'}">Balance Due: ${formatMoney(balance)}</strong></p>
                `;
            }

            const amountInput = document.getElementById("payment-amount");
            if (amountInput && balance > 0) {
                amountInput.value = balance;
            } else if (amountInput) {
                amountInput.value = "";
            }

            // Render Payment History
            if (paymentHistoryContainer) {
                paymentHistoryContainer.replaceChildren();
                const list = paymentsData.payments || [];

                if (list.length === 0) {
                    paymentHistoryContainer.innerHTML = `<p style="padding: 12px; color: var(--text-muted); font-size: 13px;">No payments recorded yet.</p>`;
                } else {
                    list.forEach((p) => {
                        const div = document.createElement("div");
                        div.className = "payment-history-item";
                        div.innerHTML = `
                            <div>
                                <strong>${formatMoney(p.amount)}</strong> &bull; <span>${escapeHtml(p.method)}</span>
                                <br><small style="color:var(--text-muted);">${escapeHtml(p.payment_date || "")}</small>
                            </div>
                            <button type="button" class="btn-sm btn-danger-sm btn-del-pay" data-pay-id="${p.id}" title="Delete payment">
                                &times;
                            </button>
                        `;

                        const delBtn = div.querySelector(".btn-del-pay");
                        if (delBtn) {
                            delBtn.addEventListener("click", async () => {
                                if (confirm(`Delete payment of ${formatMoney(p.amount)}?`)) {
                                    await fetch(`${API_BASE_URL}/payments/${p.id}`, { method: "DELETE" });
                                    loadRepairPaymentDetails(repairId);
                                    loadRepairs();
                                    loadDashboard();
                                }
                            });
                        }

                        paymentHistoryContainer.appendChild(div);
                    });
                }
            }

        } catch (err) {
            console.error("Payment details error:", err);
            if (paymentModalInfo) paymentModalInfo.innerHTML = `<p style="color:#dc2626;">Error loading repair info.</p>`;
        }
    }

    if (closePaymentModalBtn && paymentModal) {
        closePaymentModalBtn.addEventListener("click", () => paymentModal.classList.remove("active"));
        paymentModal.addEventListener("click", (e) => {
            if (e.target === paymentModal) paymentModal.classList.remove("active");
        });
    }

    if (paymentForm) {
        paymentForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const repairId = Number(paymentRepairIdInput?.value);
            const amount = Number(document.getElementById("payment-amount")?.value);
            const method = document.getElementById("payment-method")?.value || "Cash";
            const submitBtn = document.getElementById("submit-payment-btn");

            if (!repairId || isNaN(amount) || amount <= 0) {
                if (paymentFormMessage) {
                    paymentFormMessage.textContent = "Please enter a valid positive payment amount.";
                    paymentFormMessage.style.color = "#dc2626";
                }
                return;
            }

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = "Recording...";
            }

            try {
                const res = await fetch(`${API_BASE_URL}/payments/`, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        repair_id: repairId,
                        amount: Math.round(amount),
                        method: method
                    })
                });

                const data = await res.json().catch(() => ({}));

                if (!res.ok) {
                    throw new Error(data.detail || "Failed to record payment.");
                }

                if (paymentFormMessage) {
                    paymentFormMessage.textContent = `Payment of ${formatMoney(amount)} recorded! Balance Due: ${formatMoney(data.balance_due)}`;
                    paymentFormMessage.style.color = "#15803d";
                }

                // Refresh payment modal details and main tables
                await loadRepairPaymentDetails(repairId);
                loadRepairs();
                loadDashboard();

            } catch (err) {
                console.error("Record payment error:", err);
                if (paymentFormMessage) {
                    paymentFormMessage.textContent = err.message || "Failed to record payment.";
                    paymentFormMessage.style.color = "#dc2626";
                }
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = "Record Payment";
                }
            }
        });
    }

    // --- STATUS UPDATE MODAL ---
    const statusModal = document.getElementById("status-modal");
    const closeStatusModalBtn = document.getElementById("close-status-modal");
    const cancelStatusBtn = document.getElementById("cancel-status-btn");
    const updateStatusForm = document.getElementById("update-status-form");
    const statusRepairIdInput = document.getElementById("status-repair-id");
    const statusSelect = document.getElementById("update-repair-status");
    const finalCostInput = document.getElementById("update-final-cost");
    const statusModalInfo = document.getElementById("status-modal-info");
    const statusFormMessage = document.getElementById("status-form-message");

    function openStatusModal(repair) {
        if (!statusModal) return;
        statusModal.classList.add("active");

        if (statusRepairIdInput) statusRepairIdInput.value = repair.id;
        if (statusSelect) statusSelect.value = repair.status;
        if (finalCostInput) finalCostInput.value = repair.final_cost !== null && repair.final_cost !== undefined ? repair.final_cost : "";
        if (statusFormMessage) statusFormMessage.textContent = "";

        if (statusModalInfo) {
            statusModalInfo.innerHTML = `
                <p><strong>Repair:</strong> ${formatRepairId(repair.id)} &bull; <strong>Device:</strong> ${escapeHtml(repair.brand)} ${escapeHtml(repair.model)}</p>
                <p><strong>Customer:</strong> ${escapeHtml(repair.customer_name)}</p>
                <p><strong>Estimated Cost:</strong> ${formatMoney(repair.estimated_cost)} &bull; <strong>Current Status:</strong> <span class="status ${getStatusClass(repair.status)}">${escapeHtml(repair.status)}</span></p>
            `;
        }
    }

    function closeStatusModal() {
        if (statusModal) statusModal.classList.remove("active");
    }

    if (closeStatusModalBtn) closeStatusModalBtn.addEventListener("click", closeStatusModal);
    if (cancelStatusBtn) cancelStatusBtn.addEventListener("click", closeStatusModal);
    if (statusModal) {
        statusModal.addEventListener("click", (e) => {
            if (e.target === statusModal) closeStatusModal();
        });
    }

    if (updateStatusForm) {
        updateStatusForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const repairId = Number(statusRepairIdInput?.value);
            const newStatus = statusSelect?.value;
            const finalCostVal = finalCostInput?.value.trim();
            const submitBtn = document.getElementById("submit-status-btn");

            if (!repairId || !newStatus) return;

            const payload = {
                status: newStatus
            };

            if (finalCostVal !== "") {
                const numCost = Number(finalCostVal);
                if (isNaN(numCost) || numCost < 0) {
                    if (statusFormMessage) {
                        statusFormMessage.textContent = "Final cost must be a valid positive number.";
                        statusFormMessage.style.color = "#dc2626";
                    }
                    return;
                }
                payload.final_cost = Math.round(numCost);
            }

            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.textContent = "Saving...";
            }

            try {
                const res = await fetch(`${API_BASE_URL}/repairs/${repairId}`, {
                    method: "PATCH",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(payload)
                });

                const data = await res.json().catch(() => ({}));

                if (!res.ok) {
                    throw new Error(data.detail || "Could not update repair status.");
                }

                if (statusFormMessage) {
                    statusFormMessage.textContent = "Status updated successfully!";
                    statusFormMessage.style.color = "#15803d";
                }

                loadRepairs();
                loadDashboard();

                setTimeout(() => {
                    closeStatusModal();
                }, 800);

            } catch (err) {
                console.error("Update status error:", err);
                if (statusFormMessage) {
                    statusFormMessage.textContent = err.message || "Failed to update status.";
                    statusFormMessage.style.color = "#dc2626";
                }
            } finally {
                if (submitBtn) {
                    submitBtn.disabled = false;
                    submitBtn.textContent = "Save Changes";
                }
            }
        });
    }

    // --- CUSTOMER DETAILS MODAL ---
    const customerModal = document.getElementById("customer-details-modal");
    const closeCustomerModalBtn = document.getElementById("close-customer-modal");
    const closeCustomerModalBtn2 = document.getElementById("close-customer-modal-btn");
    const customerModalInfo = document.getElementById("customer-modal-info");
    const customerRepairsBody = document.getElementById("customer-repairs-body");

    async function openCustomerModal(customerId) {
        if (!customerModal) return;
        customerModal.classList.add("active");

        if (customerModalInfo) customerModalInfo.innerHTML = "Loading customer details...";
        if (customerRepairsBody) customerRepairsBody.innerHTML = `<tr><td colspan="6" style="text-align:center;">Loading repairs...</td></tr>`;

        try {
            const res = await fetch(`${API_BASE_URL}/customers/${customerId}`);
            if (!res.ok) throw new Error("Customer not found");

            const cust = await res.json();

            if (customerModalInfo) {
                customerModalInfo.innerHTML = `
                    <p><strong>Customer ID:</strong> CUS-${cust.id} &bull; <strong>Name:</strong> ${escapeHtml(cust.name)}</p>
                    <p><strong>Phone:</strong> ${escapeHtml(cust.phone)} &bull; <strong>Email:</strong> ${escapeHtml(cust.email || "Not provided")}</p>
                    <p><strong>Total Repair Jobs:</strong> ${cust.total_repairs || 0}</p>
                `;
            }

            if (customerRepairsBody) {
                customerRepairsBody.replaceChildren();
                const repairs = cust.repairs || [];

                if (repairs.length === 0) {
                    customerRepairsBody.innerHTML = `<tr><td colspan="6" style="text-align:center; color:var(--text-muted);">No repair jobs registered for this customer yet.</td></tr>`;
                } else {
                    repairs.forEach((r) => {
                        const tr = document.createElement("tr");
                        const billed = r.final_cost !== null && r.final_cost !== undefined ? r.final_cost : r.estimated_cost;
                        tr.innerHTML = `
                            <td><strong>${formatRepairId(r.id)}</strong></td>
                            <td>${escapeHtml(r.brand)} ${escapeHtml(r.model)}</td>
                            <td>${escapeHtml(r.issue)}</td>
                            <td><span class="status ${getStatusClass(r.status)}">${escapeHtml(r.status)}</span></td>
                            <td>${formatMoney(billed)}</td>
                            <td>${formatMoney(r.total_paid || 0)}</td>
                        `;
                        customerRepairsBody.appendChild(tr);
                    });
                }
            }

        } catch (err) {
            console.error("Customer details error:", err);
            if (customerModalInfo) customerModalInfo.innerHTML = `<p style="color:#dc2626;">Error loading customer details.</p>`;
        }
    }

    function closeCustomerModal() {
        if (customerModal) customerModal.classList.remove("active");
    }

    if (closeCustomerModalBtn) closeCustomerModalBtn.addEventListener("click", closeCustomerModal);
    if (closeCustomerModalBtn2) closeCustomerModalBtn2.addEventListener("click", closeCustomerModal);
    if (customerModal) {
        customerModal.addEventListener("click", (e) => {
            if (e.target === customerModal) closeCustomerModal();
        });
    }

    /* =====================================================
       10. UTILITIES
       ===================================================== */

    function escapeHtml(str) {
        if (str === null || str === undefined) return "";
        return String(str)
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    function debounce(func, delay) {
        let timeout;
        return function (...args) {
            clearTimeout(timeout);
            timeout = setTimeout(() => func.apply(this, args), delay);
        };
    }

    // Initialize application settings and dashboard on startup
    loadSettings();
    loadDashboard();
});
