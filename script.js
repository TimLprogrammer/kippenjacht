// Functie om secties in en uit te klappen
function toggleSection(header) {
    const content = header.nextElementSibling;
    header.classList.toggle('collapsed');
    content.classList.toggle('collapsed');
}

// Wacht tot het document volledig is geladen
document.addEventListener('DOMContentLoaded', function() {
    // Initialiseer de checklist functionaliteit
    initChecklist();
    // Initialiseer de kaart met moderne opties
    const map = L.map('map-container', {
        zoomControl: false,  // We plaatsen de zoomknoppen op een andere plek
        attributionControl: false  // We voegen attributie toe in een aangepaste stijl
    }).setView([52.1326, 5.2913], 7); // Standaard op Nederland gericht

    // Optie 1: Kleurrijke kaartlaag (CartoDB - Voyager) - gedetailleerd en kleurrijk
    const voyagerLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
        maxZoom: 20,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    });

    // Optie 2: Moderne kaartlaag (CartoDB - Positron) - licht en modern
    const positronLayer = L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 20,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
    });

    // Optie 3: Backup kaartlaag (OpenStreetMap - Mapnik) - altijd beschikbaar
    const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
    });

    // Probeer eerst de kleurrijke laag
    voyagerLayer.addTo(map);

    // Fallback mechanisme voor als de eerste laag faalt
    voyagerLayer.on('tileerror', function() {
        console.log('Voyager layer failed, switching to Positron');
        map.removeLayer(voyagerLayer);
        positronLayer.addTo(map);

        // Fallback mechanisme voor als de tweede laag ook faalt
        positronLayer.on('tileerror', function() {
            console.log('Positron layer failed, switching to OSM');
            map.removeLayer(positronLayer);
            osmLayer.addTo(map);
        });
    });

    // Voeg zoomknoppen toe op een betere plek (rechtsboven)
    L.control.zoom({
        position: 'topright'
    }).addTo(map);

    // Voeg een schaal toe aan de kaart in een moderne stijl
    L.control.scale({
        imperial: false,  // Alleen metrisch systeem
        maxWidth: 200,
        position: 'bottomright'
    }).addTo(map);

    // Voeg attributie toe in een aangepaste stijl
    L.control.attribution({
        position: 'bottomright',
        prefix: 'FCC Kippenjacht 2025'
    }).addTo(map);

    // Variabelen voor markers en gebieden
    let marker = null;
    let areaPolygon = null;
    let latitudeLine = null;
    let longitudeLine = null;
    let popup = null;

    // Luister naar het formulier
    document.getElementById('gpsForm').addEventListener('submit', function(event) {
        event.preventDefault(); // Voorkom standaard formulier gedrag

        // Haal de ingevoerde waarden op
        const latitudeInput = document.getElementById('latitude').value.trim();
        const longitudeInput = document.getElementById('longitude').value.trim();

        // Verwijder bestaande markers en gebieden
        clearMapElements();

        // Verberg eventuele eerdere foutmeldingen
        updateInfo('', '');

        // Controleer of er coördinaten zijn ingevoerd
        if (!latitudeInput && !longitudeInput) {
            updateInfo('Voer ten minste één coördinaat in.', '');
            return;
        }

        // Visualiseer de coördinaten
        visualizeCoordinates(latitudeInput, longitudeInput);
    });

    // Initialiseer de invoervelden
    const latitudeInput = document.getElementById('latitude');
    const longitudeInput = document.getElementById('longitude');

    // Sla de initiële waarden op
    latitudeInput.oldValue = '';
    longitudeInput.oldValue = '';

    // Luister naar input events om foutmeldingen te verbergen en automatisch punten toe te voegen
    latitudeInput.addEventListener('input', function(e) {
        updateInfo('', '');
        autoAddDecimalPoint(e.target);
    });

    longitudeInput.addEventListener('input', function(e) {
        updateInfo('', '');
        autoAddDecimalPoint(e.target);
    });

    // Luister ook naar keydown events om backspace op de punt te detecteren
    latitudeInput.addEventListener('keydown', handleKeyDown);
    longitudeInput.addEventListener('keydown', handleKeyDown);

    // Functie om backspace en delete toetsen te behandelen
    function handleKeyDown(e) {
        const input = e.target;
        const cursorPosition = input.selectionStart;

        // Markeer als de gebruiker backspace of delete indrukt bij een punt
        if ((e.key === 'Backspace' && input.value.charAt(cursorPosition - 1) === '.') ||
            (e.key === 'Delete' && input.value.charAt(cursorPosition) === '.')) {
            input.isRemovingDecimal = true;
        } else {
            input.isRemovingDecimal = false;
        }
    };

    // Functie om automatisch een punt toe te voegen na het 2e cijfer
    function autoAddDecimalPoint(inputElement) {
        const value = inputElement.value;
        const cursorPosition = inputElement.selectionStart;

        // Verwijder niet-numerieke tekens behalve punten
        let cleanValue = value.replace(/[^0-9.]/g, '');

        // Sla de huidige bewerking over als de gebruiker de punt aan het verwijderen is
        if (inputElement.isRemovingDecimal ||
            (value.length < inputElement.oldValue?.length &&
             inputElement.oldValue?.includes('.') && !value.includes('.'))) {
            // Sta toe dat de punt wordt verwijderd
            inputElement.oldValue = value;
            inputElement.isRemovingDecimal = false;
            return;
        }

        // Als er al een punt is, zorg ervoor dat er maar één punt is
        if (cleanValue.includes('.')) {
            const parts = cleanValue.split('.');
            cleanValue = parts[0] + '.' + parts.slice(1).join('');
        }
        // Als er nog geen punt is en er zijn minstens 2 cijfers, voeg een punt toe na het 2e cijfer
        else if (cleanValue.length >= 2 && !cleanValue.includes('.')) {
            cleanValue = cleanValue.substring(0, 2) + '.' + cleanValue.substring(2);
        }

        // Bereken hoeveel tekens zijn toegevoegd/verwijderd om de cursor juist te plaatsen
        const lengthDiff = cleanValue.length - value.length;

        // Update de waarde alleen als deze is veranderd
        if (cleanValue !== value) {
            inputElement.value = cleanValue;

            // Plaats de cursor op de juiste positie
            // Als een punt is toegevoegd na de cursorpositie, verplaats de cursor voorbij de punt
            if (cursorPosition >= 2 && cleanValue.charAt(2) === '.' && value.charAt(2) !== '.') {
                inputElement.setSelectionRange(cursorPosition + 1, cursorPosition + 1);
            } else {
                // Anders behoud de cursor op dezelfde relatieve positie
                inputElement.setSelectionRange(cursorPosition + lengthDiff, cursorPosition + lengthDiff);
            }
        }

        // Sla de huidige waarde op voor de volgende keer
        inputElement.oldValue = cleanValue;
    }

    // Functie om coördinaten te visualiseren
    function visualizeCoordinates(latitudeInput, longitudeInput) {
        // Bepaal de precisie van de ingevoerde coördinaten
        const latPrecision = getPrecision(latitudeInput);
        const lonPrecision = getPrecision(longitudeInput);

        // Converteer naar getallen (of null als niet ingevoerd)
        const lat = latitudeInput ? parseFloat(latitudeInput) : null;
        const lon = longitudeInput ? parseFloat(longitudeInput) : null;

        // Controleer of de waarden binnen geldige bereiken vallen
        if (lat !== null && (isNaN(lat) || lat < -90 || lat > 90)) {
            updateInfo('Zo kan je de kippen nooit vinden, ongeldige breedtegraad. Moet tussen -90 en 90 liggen.', '');
            return;
        }

        if (lon !== null && (isNaN(lon) || lon < -180 || lon > 180)) {
            updateInfo('Zo kan je de kippen nooit vinden, ongeldige lengtegraad. Moet tussen -180 en 180 liggen.', '');
            return;
        }

        // Bereken de mogelijke bereiken op basis van precisie
        let latRange, lonRange;

        if (lat !== null) {
            // Bereken het bereik op basis van de precisie
            // Voor 9-cijferige coördinaten willen we het volledige bereik tonen
            const latStep = Math.pow(10, -latPrecision);
            // Rond de ondergrens af naar beneden en de bovengrens naar boven
            // om ervoor te zorgen dat het bereik correct is
            const latLower = Math.floor(lat * Math.pow(10, latPrecision)) / Math.pow(10, latPrecision);
            const latUpper = latLower + latStep;
            latRange = [latLower, latUpper];
        }

        if (lon !== null) {
            const lonStep = Math.pow(10, -lonPrecision);
            // Rond de ondergrens af naar beneden en de bovengrens naar boven
            // om ervoor te zorgen dat het bereik correct is
            const lonLower = Math.floor(lon * Math.pow(10, lonPrecision)) / Math.pow(10, lonPrecision);
            const lonUpper = lonLower + lonStep;
            lonRange = [lonLower, lonUpper];
        }

        // Update de informatie tekst
        updateInfoBasedOnInput(lat, lon, latPrecision, lonPrecision, latRange, lonRange);

        // Visualiseer op de kaart
        if (lat !== null && lon !== null) {
            // Beide coördinaten zijn ingevoerd
            if (latPrecision < 7 || lonPrecision < 7) {
                // Onvolledige precisie (minder dan 9 cijfers), toon een gebied
                visualizeArea(latRange, lonRange);
            } else {
                // Volledige precisie (9 cijfers), toon een marker met aangepaste stijl
                const chickenIcon = L.divIcon({
                    html: '<div class="chicken-marker"><span>🐔</span></div>',
                    className: '',
                    iconSize: [40, 40],
                    iconAnchor: [20, 40]
                });

                marker = L.marker([lat, lon], {
                    icon: chickenIcon,
                    riseOnHover: true
                }).addTo(map);

                // Voeg een popup toe met informatie in moderne stijl
                marker.bindPopup(
                    `<div class="modern-popup">
                        <h4>Kippen gevonden!</h4>
                    </div>`,
                    {
                        className: 'modern-popup-container',
                        maxWidth: 300
                    }
                ).openPopup();

                // Zoom naar de marker
                map.setView([lat, lon], 15);
            }
        } else if (lat !== null) {
            // Alleen breedtegraad is ingevoerd
            visualizeLatitudeLine(lat);
        } else if (lon !== null) {
            // Alleen lengtegraad is ingevoerd
            visualizeLongitudeLine(lon);
        }
    }

    // Functie om een gebied te visualiseren
    function visualizeArea(latRange, lonRange) {
        // Maak een rechthoek op basis van de coördinaat bereiken
        const bounds = [
            [latRange[0], lonRange[0]], // zuidwest
            [latRange[1], lonRange[1]]  // noordoost
        ];

        // Voeg de rechthoek toe aan de kaart met moderne stijl
        areaPolygon = L.rectangle(bounds, {
            color: "#3498db",
            weight: 3,
            fillOpacity: 0.2,
            fillColor: "#3498db",
            dashArray: '5, 5',  // Gestippelde lijn voor moderne look
            smoothFactor: 1.5,  // Vloeiendere randen
            interactive: true   // Zorgt ervoor dat de rechthoek interactief is
        }).addTo(map);

        // Voeg een popup toe met informatie over het bereik in moderne stijl
        const popupContent = `
            <div class="modern-popup">
                <h4>Kippenhok</h4>
                <p>De kippen bevinden zich ergens in dit gebied!</p>
            </div>
        `;

        popup = L.popup()
            .setLatLng([(latRange[0] + latRange[1]) / 2, (lonRange[0] + lonRange[1]) / 2])
            .setContent(popupContent)
            .openOn(map);

        // Voeg ook een popup toe aan de rechthoek zelf
        areaPolygon.bindPopup(popupContent);

        // Voeg een kipicoon toe in het midden van het gebied
        const centerLat = (latRange[0] + latRange[1]) / 2;
        const centerLon = (lonRange[0] + lonRange[1]) / 2;

        // Maak een kipicoon
        const chickenIcon = L.divIcon({
            html: '<div class="chicken-marker area-chicken"><span>🐔</span></div>',
            className: '',
            iconSize: [40, 40],
            iconAnchor: [20, 40]
        });

        // Voeg de marker toe aan de kaart
        marker = L.marker([centerLat, centerLon], {
            icon: chickenIcon,
            riseOnHover: true
        }).addTo(map);

        // Zoom naar het gebied met wat padding
        map.fitBounds(bounds, { padding: [50, 50] });
    }

    // Functie om een breedtegraad lijn te visualiseren
    function visualizeLatitudeLine(lat) {
        // Maak een lijn over de hele wereld op deze breedtegraad
        const linePoints = [
            [lat, -180],
            [lat, 180]
        ];

        latitudeLine = L.polyline(linePoints, {
            color: '#e74c3c',
            weight: 3
        }).addTo(map);

        // Voeg een popup toe met informatie
        latitudeLine.bindPopup(`<b>Breedtegraad:</b> ${lat}`);

        // Zoom naar een geschikte weergave
        map.setView([lat, 0], 2);

        // Toon een popup met informatie in moderne stijl
        popup = L.popup({
            className: 'modern-popup-container',
            maxWidth: 300
        })
            .setLatLng([lat, 0])
            .setContent(`
                <div class="modern-popup">
                    <h4>Breedtegraad: ${lat}</h4>
                    <p>Ergens op deze lijn zitten de kippentjes.</p>
                </div>
            `)
            .openOn(map);
    }

    // Functie om een lengtegraad lijn te visualiseren
    function visualizeLongitudeLine(lon) {
        // Maak een lijn van noord naar zuid op deze lengtegraad
        const linePoints = [
            [-90, lon],
            [90, lon]
        ];

        longitudeLine = L.polyline(linePoints, {
            color: '#2ecc71',
            weight: 3
        }).addTo(map);

        // Voeg een popup toe met informatie
        longitudeLine.bindPopup(`<b>Lengtegraad:</b> ${lon}`);

        // Zoom naar een geschikte weergave
        map.setView([0, lon], 2);

        // Toon een popup met informatie in moderne stijl
        popup = L.popup({
            className: 'modern-popup-container',
            maxWidth: 300
        })
            .setLatLng([0, lon])
            .setContent(`
                <div class="modern-popup">
                    <h4>Lengtegraad: ${lon}</h4>
                    <p>Ergens op deze lijn zitten de kippentjes.</p>
                </div>
            `)
            .openOn(map);
    }

    // Functie om de precisie van een ingevoerde coördinaat te bepalen
    function getPrecision(input) {
        if (!input) return 0;

        const parts = input.split('.');
        if (parts.length === 1) return 0; // Geen decimalen

        return parts[1].length;
    }

    // Functie om de informatie tekst bij te werken
    function updateInfo(message, precisionInfo) {
        const errorContainer = document.getElementById('error-container');
        const coordinateInfo = document.getElementById('coordinate-info');
        const precisionInfoElement = document.getElementById('precision-info');

        coordinateInfo.textContent = message;
        precisionInfoElement.textContent = precisionInfo;

        // Toon of verberg de foutmelding op basis van of er een bericht is
        if (message) {
            errorContainer.classList.add('visible');
        } else {
            errorContainer.classList.remove('visible');
        }
    }

    // Functie om de informatie tekst bij te werken op basis van de invoer
    // Parameters worden niet gebruikt maar behouden voor compatibiliteit
    function updateInfoBasedOnInput() {
        // Laat de informatietekst leeg - we tonen geen extra informatie meer
        updateInfo('', '');
    }

    // Functie om alle markers en gebieden van de kaart te verwijderen
    function clearMapElements() {
        if (marker) {
            map.removeLayer(marker);
            marker = null;
        }

        if (areaPolygon) {
            map.removeLayer(areaPolygon);
            areaPolygon = null;
        }

        if (latitudeLine) {
            map.removeLayer(latitudeLine);
            latitudeLine = null;
        }

        if (longitudeLine) {
            map.removeLayer(longitudeLine);
            longitudeLine = null;
        }

        if (popup) {
            map.closePopup(popup);
            popup = null;
        }
    }

    // Functie om de checklist functionaliteit te initialiseren
    function initChecklist() {
        // Verzamel alle checkboxes
        const latCheckboxes = document.querySelectorAll('.task-checkbox[id^="lat-task"]');
        const lonCheckboxes = document.querySelectorAll('.task-checkbox[id^="lon-task"]');
        const latSpecial = document.getElementById('lat-special');
        const lonSpecial = document.getElementById('lon-special');

        // Voeg event listeners toe aan alle checkboxes
        latCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', updateProgress);
        });

        lonCheckboxes.forEach(checkbox => {
            checkbox.addEventListener('change', updateProgress);
        });

        latSpecial.addEventListener('change', updateProgress);
        lonSpecial.addEventListener('change', updateProgress);

        // Laad opgeslagen voortgang uit localStorage
        loadProgress();

        // Update de voortgangsbalken
        updateProgress();

        // Klap alle secties standaard in, behalve de Regels-sectie
        const sectionHeaders = document.querySelectorAll('.section-header');
        sectionHeaders.forEach(header => {
            // Controleer of dit de Regels-sectie is
            const isRulesSection = header.querySelector('h2') && header.querySelector('h2').textContent.trim() === 'Regels';

            // Als het niet de Regels-sectie is, klap deze dan in
            if (!isRulesSection) {
                toggleSection(header);
            }
        });
    }

    // Functie om de voortgang bij te werken
    function updateProgress() {
        // Tel het aantal voltooide taken
        const latCheckboxes = document.querySelectorAll('.task-checkbox[id^="lat-task"]');
        const lonCheckboxes = document.querySelectorAll('.task-checkbox[id^="lon-task"]');
        const latSpecial = document.getElementById('lat-special');
        const lonSpecial = document.getElementById('lon-special');

        let latCompleted = 0;
        let lonCompleted = 0;

        // Tel normale opdrachten
        latCheckboxes.forEach(checkbox => {
            if (checkbox.checked) latCompleted++;
        });

        lonCheckboxes.forEach(checkbox => {
            if (checkbox.checked) lonCompleted++;
        });

        // Tel specials (tellen voor 2 coördinaten)
        if (latSpecial.checked) latCompleted += 2;
        if (lonSpecial.checked) lonCompleted += 2;

        // Maximaal 9 coördinaten per type
        latCompleted = Math.min(latCompleted, 9);
        lonCompleted = Math.min(lonCompleted, 9);

        // Update de voortgangsbalken
        const latProgress = document.getElementById('lat-progress');
        const lonProgress = document.getElementById('lon-progress');
        const latCount = document.getElementById('lat-count');
        const lonCount = document.getElementById('lon-count');

        const latPercentage = (latCompleted / 9) * 100;
        const lonPercentage = (lonCompleted / 9) * 100;

        latProgress.style.width = `${latPercentage}%`;
        lonProgress.style.width = `${lonPercentage}%`;

        latCount.textContent = `${latCompleted}/9`;
        lonCount.textContent = `${lonCompleted}/9`;

        // Sla de voortgang op in localStorage
        saveProgress();
    }

    // Functie om de voortgang op te slaan
    function saveProgress() {
        const checkboxes = document.querySelectorAll('.task-checkbox');
        const progress = {};

        checkboxes.forEach(checkbox => {
            progress[checkbox.id] = checkbox.checked;
        });

        localStorage.setItem('kippenjacht-progress', JSON.stringify(progress));
    }

    // Functie om de voortgang te laden
    function loadProgress() {
        const savedProgress = localStorage.getItem('kippenjacht-progress');

        if (savedProgress) {
            const progress = JSON.parse(savedProgress);

            Object.keys(progress).forEach(id => {
                const checkbox = document.getElementById(id);
                if (checkbox) {
                    checkbox.checked = progress[id];
                }
            });
        }
    }
});