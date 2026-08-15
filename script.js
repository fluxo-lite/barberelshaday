document.addEventListener("DOMContentLoaded", function () {

    /* ==========================================================
       DADOS MOCKADOS & CONFIGURAÇÕES
       ========================================================== */
    const PROFESSIONAL = "Fulano";

    const SERVICES = [
        { id: "corte-social", title: "Corte Social", price: 25, duration: "30min", icon: "✂️" },
        { id: "barba", title: "Barba", price: 20, duration: "20min", icon: "🪒" },
        { id: "sobrancelha", title: "Sobrancelha", price: 15, duration: "15min", icon: "✨" }
    ];

    const TIME_SLOTS = [
        "09:55", "10:20", "14:00", "14:25", "14:50", "15:15", "15:40", "16:05",
        "16:30", "16:55", "17:20", "17:45", "18:10", "18:35", "19:00", "19:25",
        "19:50", "20:15", "20:40", "21:05"
    ];

    const DOW = ["DOM", "SEG", "TER", "QUA", "QUI", "SEX", "SAB"];

    const HISTORY_MOCK = [
        { label: "seg, 03 ago 2026", service: "Barba", price: 20 },
        { label: "ter, 21 jul 2026", service: "Corte Social", price: 25 }
    ];

    function generateDays(count) {
        const days = [];
        for (let i = 0; i < count; i++) {
            const d = new Date();
            d.setDate(d.getDate() + i);
            days.push({
                date: d,
                dow: i === 0 ? "HOJE" : DOW[d.getDay()],
                num: String(d.getDate()).padStart(2, "0"),
                fullLabel: d.toLocaleDateString("pt-BR", { weekday: "short", day: "2-digit", month: "short" }).replace(".", ""),
                fullyBooked: false // A API definirá a ocupação real
            });
        }
        return days;
    }

    /* ==========================================================
    ESTADO & LOCALSTORAGE
    ========================================================== */
    const STORAGE_KEY = "elshaday_client_data";

    // Tenta carregar dados salvos do navegador
    const savedData = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};

    const state = {
        clientName: savedData.clientName || null,
        clientEmail: savedData.clientEmail || null,
        clientPhone: savedData.clientPhone || null,
        selectedService: null,
        selectedDay: null,
        selectedTime: null,
        currentAppointment: null
    };

    // Função utilitária para salvar sempre que um dado for preenchido
    function saveClientData() {
        const dataToSave = {
            clientName: state.clientName,
            clientEmail: state.clientEmail,
            clientPhone: state.clientPhone
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(dataToSave));
    }

    function firstName(fullName) {
        return (fullName || "").trim().split(" ")[0];
    }

    const chatStream = document.getElementById("chat-stream");
    const screenChat = document.getElementById("screen-chat");
    const screenAppointments = document.getElementById("screen-appointments");

    function fmtPrice(v) {
        return "R$ " + v.toFixed(2).replace(".", ",");
    }

    function scrollToBottom() {
        window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" });
    }

    function renderIntroStep() {
        addBotMessage("Olá, tudo bem? Sou a assistente virtual do Barbeiro e cuido do agendamento dos serviços, ok?");
        setTimeout(() => {
            addBotMessage("Qual o seu nome? Escreva seu nome e sobrenome, por favor.");
            renderTextInputStep({
                type: "text",
                placeholder: "Seu nome e sobrenome",
                onSubmit: (val) => {
                    state.clientName = val;
                    saveClientData(); // Salva no LocalStorage
                    addUserMessage(val);
                    setTimeout(renderEmailStep, 320);
                }
            });
        }, 350);
    }

    function renderEmailStep() {
        addBotMessage("Qual o seu e-mail?");
        renderTextInputStep({
            type: "email",
            placeholder: "Seu e-mail",
            validate: (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
            onSubmit: (val) => {
                state.clientEmail = val;
                saveClientData(); // Salva no LocalStorage
                addUserMessage(val);
                setTimeout(renderPhoneStep, 320);
            }
        });
    }

    function renderPhoneStep() {
        addBotMessage("E o seu telefone com WhatsApp? Escreva com DDD, por favor.");
        renderTextInputStep({
            type: "tel",
            placeholder: "(88) 99999-9999",
            onSubmit: (val) => {
                state.clientPhone = val;
                saveClientData(); // Salva no LocalStorage
                addUserMessage(val);
                setTimeout(() => {
                    askForService(`Perfeito, ${firstName(state.clientName)}! Já tenho seus dados salvos.`);
                }, 320);
            }
        });
    }

    /* ==========================================================
       FUNÇÃO DE CONSULTA À API (SUPABASE)
       ========================================================== */
    async function fetchSlotsOcupados(dataIso) {
        try {
            const res = await fetch(`/api/horarios?date=${dataIso}`);
            if (!res.ok) return [];
            const data = await res.json();
            return data.ocupados || [];
        } catch (err) {
            console.error("Erro ao buscar horários ocupados:", err);
            return [];
        }
    }

    function addBotMessage(html) {
        const el = document.createElement("div");
        el.className = "msg msg-bot";
        el.innerHTML = html;
        chatStream.appendChild(el);
        scrollToBottom();
        return el;
    }

    function addUserMessage(text) {
        const el = document.createElement("div");
        el.className = "msg msg-user";
        el.textContent = text;
        chatStream.appendChild(el);
        scrollToBottom();
        return el;
    }

    function addWidget(innerEl) {
        const wrap = document.createElement("div");
        wrap.className = "msg msg-widget";
        wrap.appendChild(innerEl);
        chatStream.appendChild(wrap);
        scrollToBottom();
        return wrap;
    }

    /* ==========================================================
       WIDGET GENÉRICO DE INPUT DE TEXTO
       ========================================================== */
    function renderTextInputStep(opts) {
        const box = document.createElement("div");
        box.innerHTML = `
            <input type="${opts.type || "text"}" class="chat-input mb-2" id="text-input-field" placeholder="${opts.placeholder}">
            <button class="btn-chat btn-chat-primary" id="text-input-submit">${opts.buttonText || "Enviar"}</button>
        `;
        const input = box.querySelector("#text-input-field");
        const btn = box.querySelector("#text-input-submit");

        function trySubmit() {
            const val = input.value.trim();
            if (!val || box.classList.contains("locked")) return;
            if (opts.validate && !opts.validate(val)) {
                input.classList.add("is-invalid");
                return;
            }
            box.classList.add("locked");
            opts.onSubmit(val);
        }

        btn.addEventListener("click", trySubmit);
        input.addEventListener("keydown", (e) => {
            input.classList.remove("is-invalid");
            if (e.key === "Enter") trySubmit();
        });

        addWidget(box);
        setTimeout(() => input.focus(), 50);
        return box;
    }

    /* ==========================================================
       ETAPA 0 — BOAS-VINDAS E DADOS DE CONTATO
       ========================================================== */
    function renderIntroStep() {
        addBotMessage("Olá, tudo bem? Sou a assistente virtual da Barbearia Fulana e cuido do agendamento dos serviços, ok?");
        setTimeout(() => {
            addBotMessage("Qual o seu nome? Escreva seu nome e sobrenome, por favor.");
            renderTextInputStep({
                type: "text",
                placeholder: "Seu nome e sobrenome",
                onSubmit: (val) => {
                    state.clientName = val;
                    addUserMessage(val);
                    setTimeout(renderEmailStep, 320);
                }
            });
        }, 350);
    }

    function renderEmailStep() {
        addBotMessage("Qual o seu e-mail?");
        renderTextInputStep({
            type: "email",
            placeholder: "Seu e-mail",
            validate: (val) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val),
            onSubmit: (val) => {
                state.clientEmail = val;
                addUserMessage(val);
                setTimeout(renderPhoneStep, 320);
            }
        });
    }

    function renderPhoneStep() {
        addBotMessage("E o seu telefone com WhatsApp? Escreva com DDD, por favor.");
        renderTextInputStep({
            type: "tel",
            placeholder: "(88) 99999-9999",
            onSubmit: (val) => {
                state.clientPhone = val;
                addUserMessage(val);
                setTimeout(() => {
                    askForService(`Perfeito, ${firstName(state.clientName)}! Já tenho seus dados salvos.`);
                }, 320);
            }
        });
    }

    function askForService(introMessage) {
        addBotMessage(introMessage);
        setTimeout(() => {
            addBotMessage("Por qual serviço você está procurando?");
            renderServiceStep();
        }, 350);
    }

    /* ==========================================================
       ETAPA 1 — SERVIÇOS
       ========================================================== */
    function renderServiceStep() {
        const box = document.createElement("div");
        box.innerHTML = `
            <div class="step-label">Selecione o serviço</div>
            <div class="h-scroll" id="service-scroll"></div>
            <button class="btn-chat btn-chat-primary mt-3" id="service-submit" disabled>Enviar</button>
        `;
        const scroll = box.querySelector("#service-scroll");

        SERVICES.forEach(s => {
            const card = document.createElement("div");
            card.className = "service-card";
            card.dataset.id = s.id;
            card.innerHTML = `
                <div class="service-thumb">${s.icon}</div>
                <div class="service-body">
                    <h6 class="fw-bold mb-1">${s.title}</h6>
                    <div class="service-price">${fmtPrice(s.price)}</div>
                    <div class="service-dur">⏱ ${s.duration}</div>
                </div>
            `;
            scroll.appendChild(card);
        });

        const submitBtn = box.querySelector("#service-submit");
        let localSelected = null;

        scroll.addEventListener("click", (e) => {
            const card = e.target.closest(".service-card");
            if (!card || box.classList.contains("locked")) return;
            scroll.querySelectorAll(".service-card").forEach(c => c.classList.remove("selected"));
            card.classList.add("selected");
            localSelected = SERVICES.find(s => s.id === card.dataset.id);
            submitBtn.disabled = false;
        });

        submitBtn.addEventListener("click", () => {
            if (!localSelected || box.classList.contains("locked")) return;
            state.selectedService = localSelected;
            box.classList.add("locked");
            addUserMessage(localSelected.title);
            setTimeout(() => {
                addBotMessage("Certo! E qual o melhor dia e horário para você ser atendido?");
                renderDayTimeStep();
            }, 320);
        });

        addWidget(box);
        return box;
    }

    /* ==========================================================
       ETAPA 2 — DIA E HORÁRIO (DINÂMICO VIA SUPABASE)
       ========================================================== */
    function renderDayTimeStep() {
        const days = generateDays(7);

        const box = document.createElement("div");
        box.innerHTML = `
            <div class="step-label">Selecione o dia e horário</div>
            <div class="day-scroll" id="day-scroll"></div>
            <div class="scroll-hint">arraste para o lado para ver mais</div>
            <div id="slots-area"></div>
            <div class="selected-date-bar" id="date-bar">Escolha um dia acima</div>
            <button class="btn-chat btn-chat-primary" id="datetime-submit" disabled>Enviar</button>
            <button class="btn-chat btn-chat-ghost mt-2" id="datetime-back">← Voltar aos serviços</button>
        `;

        const dayScroll = box.querySelector("#day-scroll");
        const slotsArea = box.querySelector("#slots-area");
        const dateBar = box.querySelector("#date-bar");
        const submitBtn = box.querySelector("#datetime-submit");

        let localDay = null;
        let localTime = null;

        days.forEach((d, idx) => {
            const pill = document.createElement("div");
            pill.className = "day-pill";
            pill.dataset.idx = idx;
            pill.innerHTML = `<div class="dow">${d.dow}</div><div class="num">${d.num}</div>`;
            dayScroll.appendChild(pill);
        });

        async function renderSlots() {
            slotsArea.innerHTML = "<div class='text-center p-3 text-muted'>Carregando horários...</div>";
            submitBtn.disabled = true;
            localTime = null;

            const dataIso = localDay.date.toISOString().split('T')[0];
            const ocupados = await fetchSlotsOcupados(dataIso);

            slotsArea.innerHTML = "";

            const grid = document.createElement("div");
            grid.className = "row g-2";
            
            TIME_SLOTS.forEach(t => {
                const isOcupado = ocupados.includes(t);
                const col = document.createElement("div");
                col.className = "col-4";
                
                if (isOcupado) {
                    col.innerHTML = `<div class="time-slot disabled" style="opacity: 0.3; cursor: not-allowed; background: #2a2a2a;">${t}</div>`;
                } else {
                    col.innerHTML = `<div class="time-slot" data-time="${t}">${t}</div>`;
                }
                grid.appendChild(col);
            });
            slotsArea.appendChild(grid);

            grid.addEventListener("click", (e) => {
                const slot = e.target.closest(".time-slot");
                if (!slot || slot.classList.contains("disabled") || box.classList.contains("locked")) return;
                grid.querySelectorAll(".time-slot").forEach(s => s.classList.remove("selected"));
                slot.classList.add("selected");
                localTime = slot.dataset.time;
                submitBtn.disabled = false;
            });
        }

        dayScroll.addEventListener("click", (e) => {
            const pill = e.target.closest(".day-pill");
            if (!pill || box.classList.contains("locked")) return;
            dayScroll.querySelectorAll(".day-pill").forEach(p => p.classList.remove("selected"));
            pill.classList.add("selected");
            localDay = days[pill.dataset.idx];
            dateBar.textContent = localDay.fullLabel;
            renderSlots();
        });

        submitBtn.addEventListener("click", () => {
            if (!localDay || !localTime || box.classList.contains("locked")) return;
            state.selectedDay = localDay;
            state.selectedTime = localTime;
            box.classList.add("locked");
            addUserMessage(`${localDay.fullLabel} às ${localTime}`);
            setTimeout(finishBooking, 320);
        });

        box.querySelector("#datetime-back").addEventListener("click", () => {
            if (box.classList.contains("locked")) return;
            widgetEl.remove();
            botMsgEl.remove();
            userServiceMsgEl.remove();
            serviceWidgetEl.classList.remove("locked");
        });

        const botMsgEl = chatStream.lastElementChild;
        const userServiceMsgEl = botMsgEl.previousElementSibling;
        const serviceWidgetEl = userServiceMsgEl.previousElementSibling;
        const widgetEl = addWidget(box);
    }

    /* ==========================================================
       ETAPA 3 — CONFIRMAÇÃO (CORRIGIDA)
       ========================================================== */
    async function finishBooking() {
        const s = state.selectedService;
        const d = state.selectedDay;
        const t = state.selectedTime;
        const dataIso = d.date.toISOString().split('T')[0];

        // 1. Grava no Supabase e Notifica via Telegram chamando a Serverless API
        try {
            await fetch('/api/agendar', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    clienteNome: state.clientName,
                    clienteEmail: state.clientEmail,
                    clienteTelefone: state.clientPhone,
                    servico: s,
                    data: dataIso,
                    hora: t
                })
            });
        } catch (err) {
            console.error("Erro ao registrar agendamento na API:", err);
        }

        // 2. Fluxo visual no chat do cliente
        addBotMessage(`Agendamento realizado: Um(a) <strong>${s.title}</strong> - (${fmtPrice(s.price)}), com o(a) ${PROFESSIONAL} no(a) ${d.fullLabel} às ${t}.`);

        setTimeout(() => {
            addBotMessage(`<strong>*OLÁ, AGENDAMENTO CONFIRMADO*</strong><br>Não se atrasar! Caso se atrase, você tem 5 min de tolerância!`);
        }, 280);

        setTimeout(() => {
            const photoBox = document.createElement("div");
            photoBox.innerHTML = `
                Muito obrigado, até mais!
                <div class="avatar-photo">💈</div>
            `;
            const wrap = document.createElement("div");
            wrap.className = "msg msg-bot";
            wrap.appendChild(photoBox);
            chatStream.appendChild(wrap);
            scrollToBottom();
        }, 560);

        setTimeout(() => {
            state.currentAppointment = { service: s, day: d, time: t };
            renderAppointmentCard();

            const actions = document.createElement("div");
            actions.className = "d-grid gap-2";
            actions.innerHTML = `
                <button class="btn-chat btn-gold" id="action-my-appointments">Meus agendamentos</button>
                <button class="btn-chat btn-gold" id="action-new-booking">Novo agendamento</button>
                <button class="btn-chat btn-outline-gold" id="action-save-agenda">Salvar na agenda</button>
            `;
            addWidget(actions);

            actions.querySelector("#action-my-appointments").addEventListener("click", showAppointmentsScreen);
            actions.querySelector("#action-new-booking").addEventListener("click", resetFlow);
            actions.querySelector("#action-save-agenda").addEventListener("click", saveToAgenda);
        }, 840);
    }

    function saveToAgenda() {
        const s = state.selectedService;
        const d = state.selectedDay;
        const t = state.selectedTime;
        if (!s || !d || !t) return;

        const [hh, mm] = t.split(":");
        const start = new Date(d.date);
        start.setHours(parseInt(hh), parseInt(mm), 0, 0);
        const end = new Date(start.getTime() + 30 * 60000);
        const fmt = (dt) => dt.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";

        const ics = [
            "BEGIN:VCALENDAR", "VERSION:2.0", "BEGIN:VEVENT",
            `SUMMARY:${s.title} - Barber Shop O-Barbeiro`,
            `DESCRIPTION:Profissional: ${PROFESSIONAL}`,
            `DTSTART:${fmt(start)}`, `DTEND:${fmt(end)}`,
            "END:VEVENT", "END:VCALENDAR"
        ].join("\n");

        const blob = new Blob([ics], { type: "text/calendar" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "agendamento-el-shaday.ics";
        a.click();
    }

    /* ==========================================================
       TELA — MEUS AGENDAMENTOS
       ========================================================== */
    function renderAppointmentCard() {
        const wrap = document.getElementById("apt-current-wrap");
        const apt = state.currentAppointment;

        if (!apt) {
            wrap.innerHTML = `<div class="apt-empty">Nenhum agendamento no momento.</div>`;
            return;
        }

        wrap.innerHTML = `
            <div class="apt-card">
                <div class="d-flex justify-content-between align-items-start mb-2">
                    <div class="fw-bold">${apt.day.fullLabel} às ${apt.time}</div>
                    <button class="apt-cancel-btn" id="apt-cancel-btn">CANCELAR</button>
                </div>
                <div class="fw-bold">${apt.service.title.toUpperCase()}</div>
                <div class="d-flex justify-content-between align-items-center">
                    <span class="text-muted small">PROFISSIONAL: ${PROFESSIONAL.toUpperCase()}</span>
                    <span class="fw-bold text-warning">${fmtPrice(apt.service.price)}</span>
                </div>
            </div>
        `;

        wrap.querySelector("#apt-cancel-btn").addEventListener("click", () => {
            state.currentAppointment = null;
            renderAppointmentCard();
        });
    }

    function renderHistory() {
        const list = document.getElementById("apt-history-list");
        list.innerHTML = HISTORY_MOCK.map(h => `
            <div class="apt-card" style="background:#2a2a2a;">
                <div class="fw-bold small mb-1">${h.label}</div>
                <div class="d-flex justify-content-between align-items-center">
                    <span class="text-muted small">${h.service} · ${PROFESSIONAL}</span>
                    <span class="small text-warning">${fmtPrice(h.price)}</span>
                </div>
            </div>
        `).join("");
    }

    function showAppointmentsScreen() {
        renderAppointmentCard();
        screenChat.style.display = "none";
        screenAppointments.style.display = "block";
        window.scrollTo({ top: 0 });
    }

    function showChatScreen() {
        screenAppointments.style.display = "none";
        screenChat.style.display = "block";
        window.scrollTo({ top: 0 });
    }

    document.getElementById("btn-go-appointments").addEventListener("click", showAppointmentsScreen);
    document.getElementById("btn-back-to-chat").addEventListener("click", showChatScreen);

    /* ==========================================================
       FLUXO INICIAL
       ========================================================== */
    function resetFlow() {
        state.selectedService = null;
        state.selectedDay = null;
        state.selectedTime = null;
        chatStream.innerHTML = "";
        showChatScreen();
        startConversation();
    }

    function startConversation() {
        // Se já tivermos o nome salvo na memória do navegador, pulamos as perguntas iniciais
        if (state.clientName && state.clientPhone) {
            
            addBotMessage(`Bem-vindo(a) de volta, <strong>${firstName(state.clientName)}</strong>!`);
            
            const changeUserBtn = document.createElement("button");
            changeUserBtn.className = "btn-chat btn-chat-ghost mb-3 btn-change-user";
            changeUserBtn.style.fontSize = "0.7rem";
            changeUserBtn.textContent = "Não sou " + firstName(state.clientName);
            changeUserBtn.onclick = () => {
                localStorage.removeItem(STORAGE_KEY);
                state.clientName = null;
                state.clientEmail = null;
                state.clientPhone = null;
                chatStream.innerHTML = "";
                startConversation();
            };
            chatStream.appendChild(changeUserBtn);

            // CORREÇÃO AQUI: Substituição do askForService por chamadas diretas
            setTimeout(() => {
                addBotMessage("Por qual serviço você está procurando hoje?");
                renderServiceStep();
            }, 400);

        } else {
            renderIntroStep();
        }
    }

    renderHistory();
    startConversation();
});