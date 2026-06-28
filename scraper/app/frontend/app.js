const API_URL = "http://127.0.0.1:8004/api";

// --- Navigation Logic ---
document.querySelectorAll('.nav-links li').forEach(item => {
    item.addEventListener('click', (e) => {
        // Remove active from all
        document.querySelectorAll('.nav-links li').forEach(li => li.classList.remove('active'));
        document.querySelectorAll('.view').forEach(v => v.classList.remove('active-view'));
        
        // Add active to clicked
        e.target.classList.add('active');
        const viewId = e.target.getAttribute('data-tab');
        document.getElementById(viewId).classList.add('active-view');
    });
});

// --- Squad Builder Logic ---
document.getElementById('btn-load-squad').addEventListener('click', async () => {
    const country = document.getElementById('country-input').value.trim();
    if (!country) return;

    try {
        const res = await fetch(`${API_URL}/squad/${country}`);
        if (!res.ok) {
            alert("Country not found or no squad generated.");
            return;
        }
        const data = await res.json();
        
        // Calculate stats
        let totalImpact = 0;
        let totalInjuries = 0;
        let avgAge = 0;
        
        const tbody = document.querySelector('#roster-table tbody');
        tbody.innerHTML = '';
        
        data.players.forEach(p => {
            totalImpact += p.impact_score_raw;
            totalInjuries += p.total_injuries;
            avgAge += p.Age;
            
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${p.Player}</strong></td>
                <td>${p.Pos_Category}</td>
                <td>${p.Age.toFixed(1)}</td>
                <td>${p.Club}</td>
                <td style="color:#38bdf8">${p.impact_score_raw.toFixed(1)}</td>
                <td style="color:#f43f5e">${p.total_injuries}</td>
            `;
            tbody.appendChild(tr);
        });

        const statsDiv = document.getElementById('squad-stats');
        statsDiv.innerHTML = `
            <p><strong>Players:</strong> ${data.squad_size}</p>
            <p><strong>Avg Age:</strong> ${(avgAge/data.squad_size).toFixed(1)} years</p>
            <p><strong>Total Impact Score:</strong> ${totalImpact.toFixed(1)}</p>
            <p><strong>Total Historical Injuries:</strong> ${totalInjuries}</p>
        `;

    } catch(e) {
        console.error(e);
        alert("Error connecting to backend API.");
    }
});

// --- Autocomplete & Filter Logic ---
let debounceTimeout;
const playerInput = document.getElementById('player-input');
const autocompleteList = document.getElementById('autocomplete-list');
const filterNationality = document.getElementById('filter-nationality');

// Load nationalities on boot
fetch(`${API_URL}/nationalities`)
    .then(r => r.json())
    .then(data => {
        if(data.nationalities) {
            data.nationalities.forEach(nat => {
                const opt = document.createElement('option');
                opt.value = nat;
                opt.textContent = nat;
                filterNationality.appendChild(opt);
            });
        }
    }).catch(e => console.error("Error loading nationalities", e));

playerInput.addEventListener('input', () => {
    clearTimeout(debounceTimeout);
    const query = playerInput.value.trim();
    const country = filterNationality.value;
    
    if (query.length < 2) {
        autocompleteList.style.display = 'none';
        return;
    }
    
    debounceTimeout = setTimeout(async () => {
        try {
            const res = await fetch(`${API_URL}/players/search?q=${encodeURIComponent(query)}&country=${encodeURIComponent(country)}`);
            const data = await res.json();
            
            autocompleteList.innerHTML = '';
            if (data.results && data.results.length > 0) {
                data.results.forEach(name => {
                    const div = document.createElement('div');
                    div.style.padding = '10px';
                    div.style.cursor = 'pointer';
                    div.style.borderBottom = '1px solid rgba(255,255,255,0.1)';
                    div.textContent = name;
                    div.addEventListener('mouseover', () => div.style.background = 'rgba(255,255,255,0.1)');
                    div.addEventListener('mouseout', () => div.style.background = 'transparent');
                    div.addEventListener('click', () => {
                        playerInput.value = name;
                        autocompleteList.style.display = 'none';
                        document.getElementById('btn-search-player').click();
                    });
                    autocompleteList.appendChild(div);
                });
                autocompleteList.style.display = 'block';
            } else {
                autocompleteList.style.display = 'none';
            }
        } catch (e) {
            console.error("Autocomplete error", e);
        }
    }, 300); // 300ms debounce
});

// Close autocomplete when clicking outside
document.addEventListener('click', (e) => {
    if(e.target !== playerInput && e.target !== autocompleteList) {
        autocompleteList.style.display = 'none';
    }
});

// --- Player Explorer Logic ---
document.getElementById('btn-search-player').addEventListener('click', async () => {
    const playerName = document.getElementById('player-input').value.trim();
    if(!playerName) return;

    try {
        const res = await fetch(`${API_URL}/player/${playerName}`);
        const card = document.getElementById('player-card');
        
        if (!res.ok) {
            card.innerHTML = `<p style="color:#f43f5e">Player not found in database.</p>`;
            return;
        }
        const p = await res.json();
        
        let fifaStatsHtml = '';
        if (p.FIFA_Attributes && p.FIFA_Attributes.Overall) {
            fifaStatsHtml = `
            <div style="margin-top:20px; padding-top:15px; border-top:1px solid var(--glass-border);">
                <h4 style="margin-bottom:10px; color:var(--text-secondary);">FIFA 22 Scouting Profile</h4>
                <div style="display:flex; justify-content:space-between; text-align:center; flex-wrap:wrap; gap:10px;">
                    <div style="background:rgba(0,0,0,0.2); padding:8px; border-radius:8px; min-width:60px;">
                        <span style="font-size:0.8rem; color:var(--text-secondary); display:block;">OVR</span>
                        <strong style="color:var(--accent-color); font-size:1.2rem;">${p.FIFA_Attributes.Overall}</strong>
                    </div>
                    <div style="background:rgba(0,0,0,0.2); padding:8px; border-radius:8px; min-width:60px;">
                        <span style="font-size:0.8rem; color:var(--text-secondary); display:block;">PAC</span>
                        <strong>${p.FIFA_Attributes.Pace}</strong>
                    </div>
                    <div style="background:rgba(0,0,0,0.2); padding:8px; border-radius:8px; min-width:60px;">
                        <span style="font-size:0.8rem; color:var(--text-secondary); display:block;">SHO</span>
                        <strong>${p.FIFA_Attributes.Shooting}</strong>
                    </div>
                    <div style="background:rgba(0,0,0,0.2); padding:8px; border-radius:8px; min-width:60px;">
                        <span style="font-size:0.8rem; color:var(--text-secondary); display:block;">PAS</span>
                        <strong>${p.FIFA_Attributes.Passing}</strong>
                    </div>
                    <div style="background:rgba(0,0,0,0.2); padding:8px; border-radius:8px; min-width:60px;">
                        <span style="font-size:0.8rem; color:var(--text-secondary); display:block;">DRI</span>
                        <strong>${p.FIFA_Attributes.Dribbling}</strong>
                    </div>
                    <div style="background:rgba(0,0,0,0.2); padding:8px; border-radius:8px; min-width:60px;">
                        <span style="font-size:0.8rem; color:var(--text-secondary); display:block;">DEF</span>
                        <strong>${p.FIFA_Attributes.Defending}</strong>
                    </div>
                    <div style="background:rgba(0,0,0,0.2); padding:8px; border-radius:8px; min-width:60px;">
                        <span style="font-size:0.8rem; color:var(--text-secondary); display:block;">PHY</span>
                        <strong>${p.FIFA_Attributes.Physical}</strong>
                    </div>
                </div>
            </div>`;
        }

        card.innerHTML = `
            <div style="display:flex; gap: 20px; align-items:center;">
                <div style="width: 80px; height: 80px; background:rgba(255,255,255,0.1); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:2rem;">
                    👤
                </div>
                <div>
                    <h3 style="margin-bottom:5px; font-size:1.8rem; color:white;">${p.Player}</h3>
                    <p style="color:var(--accent-color)">${p.Country} | ${p.Club}</p>
                </div>
            </div>
            <div style="margin-top:20px; display:grid; grid-template-columns: 1fr 1fr; gap:15px;">
                <p><strong>Age:</strong> ${p.Age ? p.Age.toFixed(1) : 'N/A'}</p>
                <p><strong>Position:</strong> ${p.Position}</p>
                <p><strong>AI Cluster:</strong> ${p.Cluster}</p>
                <p><strong>Impact Score:</strong> ${p.ImpactScore ? p.ImpactScore.toFixed(1) : 'N/A'}</p>
                <p><strong>Injury Risk (Hist):</strong> ${p.TotalInjuries} previous injuries</p>
            </div>
            ${fifaStatsHtml}
        `;
    } catch(e) {
        console.error(e);
    }
});

// --- Match Predictor Logic ---
document.getElementById('btn-predict').addEventListener('click', async () => {
    const teamA = document.getElementById('team-a').value.trim();
    const teamB = document.getElementById('team-b').value.trim();
    
    // Get Weather params
    const tempMax = parseFloat(document.getElementById('weather-temp').value) || 20.0;
    const rain = parseFloat(document.getElementById('weather-rain').value) || 0.0;
    const wind = parseFloat(document.getElementById('weather-wind').value) || 10.0;

    if(!teamA || !teamB) return;

    try {
        const res = await fetch(`${API_URL}/predict_match`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                team_a: teamA, 
                team_b: teamB,
                temp_max: tempMax,
                precipitation: rain,
                wind_speed: wind
            })
        });
        const data = await res.json();
        
        const resultDiv = document.getElementById('prediction-result');
        
        const winAPercent = (data.win_prob_A * 100).toFixed(1);
        const drawPercent = (data.draw_prob * 100).toFixed(1);
        const winBPercent = (data.win_prob_B * 100).toFixed(1);

        resultDiv.innerHTML = `
            <h3 style="text-align:center; font-size:2rem; margin-bottom:5px;">
                ${teamA} <span style="color:var(--text-secondary)">vs</span> ${teamB}
            </h3>
            <p style="text-align:center; color:var(--text-secondary); font-size:0.9rem; margin-bottom:15px;">
                🌤️ ${data.weather_conditions || 'Weather Data'}
            </p>
            <p style="text-align:center; margin-bottom: 20px;">
                <strong>Predicted Winner:</strong> <span style="color:var(--accent-color); font-size:1.5rem;">${data.prediction}</span>
            </p>
            
            <p>Win Probability Breakdown:</p>
            <div class="prob-bar-container">
                <div class="prob-a" style="width: ${winAPercent}%" title="${teamA} Win">
                    ${winAPercent > 10 ? winAPercent+'%' : ''}
                </div>
                <div class="prob-draw" style="width: ${drawPercent}%" title="Draw">
                    ${drawPercent > 10 ? drawPercent+'%' : ''}
                </div>
                <div class="prob-b" style="width: ${winBPercent}%" title="${teamB} Win">
                    ${winBPercent > 10 ? winBPercent+'%' : ''}
                </div>
            </div>
            <div style="display:flex; justify-content:space-between; margin-top:5px; font-size:0.85rem; color:var(--text-secondary);">
                <span>${teamA}</span>
                <span>Draw</span>
                <span>${teamB}</span>
            </div>
        `;
        
        if (data.explanations && data.explanations.length > 0) {
            let explHtml = `<div style="margin-top:20px; padding-top:15px; border-top:1px solid rgba(255,255,255,0.1);">
                <h4 style="margin-bottom:5px; color:var(--text-secondary); font-size:1rem;">🤖 AI Explainability (SHAP)</h4>
                <p style="font-size:0.8rem; color:var(--text-secondary); margin-bottom:15px; line-height:1.4;">
                    <strong>¿Cómo leer esto?</strong> El modelo XGBoost evalúa todas las variables al mismo tiempo. Aquí mostramos el "Top 4" de factores que más pesaron en la decisión. El "Peso" es logarítmico: un valor positivo ayuda al <strong>${teamA}</strong>, mientras que un valor negativo arrastra el partido hacia un empate o victoria de <strong>${teamB}</strong>.
                </p>
                <div style="display:flex; flex-direction:column; gap:10px;">`;
                
            data.explanations.forEach(exp => {
                let barColor = exp.value.includes('+') ? '#38bdf8' : '#f43f5e';
                explHtml += `
                <div style="background:rgba(0,0,0,0.2); padding:10px; border-radius:8px; border-left: 3px solid ${barColor};">
                    <strong style="color:white; display:block; margin-bottom:3px;">${exp.feature}</strong>
                    <span style="color:var(--accent-color); font-size:0.85rem;">${exp.impact}</span>
                    <span style="color:${barColor}; font-size:0.85rem; float:right; font-weight:bold;">${exp.value}</span>
                </div>`;
            });
            
            explHtml += `</div></div>`;
            resultDiv.innerHTML += explHtml;
        }
        
    } catch(e) {
        console.error(e);
    }
});
