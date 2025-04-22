// Wacht tot het document volledig is geladen
document.addEventListener('DOMContentLoaded', function() {
    // Initialiseer de kaart
    const map = L.map('map-container').setView([52.1326, 5.2913], 7); // Standaard op Nederland gericht

    // Voeg de OpenStreetMap tile layer toe
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19
    }).addTo(map);

    // Voeg een schaal toe aan de kaart
    L.control.scale().addTo(map);

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

        // Controleer of er coördinaten zijn ingevoerd
        if (!latitudeInput && !longitudeInput) {
            updateInfo('Voer ten minste één coördinaat in.', '');
            return;
        }

        // Visualiseer de coördinaten
        visualizeCoordinates(latitudeInput, longitudeInput);
    });

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
            updateInfo('Ongeldige breedtegraad. Moet tussen -90 en 90 liggen.', '');
            return;
        }

        if (lon !== null && (isNaN(lon) || lon < -180 || lon > 180)) {
            updateInfo('Ongeldige lengtegraad. Moet tussen -180 en 180 liggen.', '');
            return;
        }

        // Bereken de mogelijke bereiken op basis van precisie
        let latRange, lonRange;

        if (lat !== null) {
            // Bereken het bereik op basis van de precisie
            // Voor 9-cijferige coördinaten willen we het volledige bereik tonen
            const latStep = Math.pow(10, -latPrecision);
            latRange = [lat, lat + latStep];
        }

        if (lon !== null) {
            const lonStep = Math.pow(10, -lonPrecision);
            lonRange = [lon, lon + lonStep];
        }

        // Update de informatie tekst
        updateInfoBasedOnInput(lat, lon, latPrecision, lonPrecision, latRange, lonRange);

        // Visualiseer op de kaart
        if (lat !== null && lon !== null) {
            // Beide coördinaten zijn ingevoerd
            if (latPrecision < 7 || lonPrecision < 7) {
                // Onvolledige precisie (minder dan 9 cijfers), toon een gebied
                visualizeArea(latRange, lonRange, latPrecision, lonPrecision);
            } else {
                // Volledige precisie (9 cijfers), toon een marker
                marker = L.marker([lat, lon]).addTo(map);

                // Voeg een popup toe met informatie
                marker.bindPopup(`<b>Exacte locatie</b><br>Breedtegraad: ${lat}<br>Lengtegraad: ${lon}`).openPopup();

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
    function visualizeArea(latRange, lonRange, latPrecision, lonPrecision) {
        // Maak een rechthoek op basis van de coördinaat bereiken
        const bounds = [
            [latRange[0], lonRange[0]], // zuidwest
            [latRange[1], lonRange[1]]  // noordoost
        ];

        // Voeg de rechthoek toe aan de kaart
        areaPolygon = L.rectangle(bounds, {
            color: "#3498db",
            weight: 2,
            fillOpacity: 0.3,
            fillColor: "#3498db"
        }).addTo(map);

        // Voeg een popup toe met informatie over het bereik
        const popupContent = `
            <div style="text-align: center;">
                <h4 style="margin: 0 0 8px 0;">Het kippenterrein</h4>
            </div>
        `;

        popup = L.popup()
            .setLatLng([(latRange[0] + latRange[1]) / 2, (lonRange[0] + lonRange[1]) / 2])
            .setContent(popupContent)
            .openOn(map);

        // Voeg ook een popup toe aan de rechthoek zelf
        areaPolygon.bindPopup(popupContent);

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

        // Toon een popup met informatie
        popup = L.popup()
            .setLatLng([lat, 0])
            .setContent(`<div style="text-align: center;"><b>Breedtegraad:</b> ${lat}<br>Alle locaties met deze breedtegraad worden getoond.</div>`)
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

        // Toon een popup met informatie
        popup = L.popup()
            .setLatLng([0, lon])
            .setContent(`<div style="text-align: center;"><b>Lengtegraad:</b> ${lon}<br>Alle locaties met deze lengtegraad worden getoond.</div>`)
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
        document.getElementById('coordinate-info').textContent = message;
        document.getElementById('precision-info').textContent = precisionInfo;
    }

    // Functie om de informatie tekst bij te werken op basis van de invoer
    function updateInfoBasedOnInput(lat, lon, latPrecision, lonPrecision, latRange, lonRange) {
        let message = '';
        let precisionInfo = '';

        if (lat !== null && lon !== null) {
            message = `Coördinaten: ${lat}, ${lon}`;

            if (latPrecision < 7 || lonPrecision < 7) {
                precisionInfo = 'Onvolledige coördinaten gedetecteerd. Het gemarkeerde gebied toont alle mogelijke locaties waar de exacte 9-cijferige coördinaten zich kunnen bevinden.';

                if (latPrecision < 7) {
                    precisionInfo += ` Breedtegraad bereik: ${latRange[0].toFixed(latPrecision)} tot ${latRange[1].toFixed(latPrecision)}.`;
                }

                if (lonPrecision < 7) {
                    precisionInfo += ` Lengtegraad bereik: ${lonRange[0].toFixed(lonPrecision)} tot ${lonRange[1].toFixed(lonPrecision)}.`;
                }
            } else {
                precisionInfo = 'Volledige coördinaten gedetecteerd. De marker toont de exacte locatie.';
            }
        } else if (lat !== null) {
            message = `Breedtegraad: ${lat}`;
            precisionInfo = 'Alleen breedtegraad ingevoerd. De rode lijn toont alle locaties met deze breedtegraad.';
        } else if (lon !== null) {
            message = `Lengtegraad: ${lon}`;
            precisionInfo = 'Alleen lengtegraad ingevoerd. De groene lijn toont alle locaties met deze lengtegraad.';
        }

        updateInfo(message, precisionInfo);
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
});
