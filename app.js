let mapa;
let miLat, miLon;
let marcadorUsuario;
let mapaInicializado = false;

// Coordenadas de Fresnillo, Zacatecas (por defecto)
const UBICACION_POR_DEFECTO = {
    lat: 23.1750,
    lon: -102.8669,
    nombre: "Fresnillo, Zacatecas"
};

/* OBTENER UBICACION REAL CON MÁS PRECISIÓN */
function inicializarMapa() {
    console.log("Obteniendo ubicación...");
    
    if (!navigator.geolocation) {
        console.log("El navegador no soporta geolocalización");
        usarUbicacionPorDefecto();
        return;
    }
    
    // Opciones para mayor precisión
    const opciones = {
        enableHighAccuracy: true,    // Usar GPS si está disponible
        timeout: 10000,             // 10 segundos máximo de espera
        maximumAge: 0               // No usar caché
    };
    
    navigator.geolocation.getCurrentPosition(
        // ÉXITO
        (position) => {
            miLat = position.coords.latitude;
            miLon = position.coords.longitude;
            
            console.log("Ubicación obtenida correctamente:");
            console.log(`   Latitud: ${miLat}`);
            console.log(`   Longitud: ${miLon}`);
            console.log(`   Precisión: ${position.coords.accuracy} metros`);
            
            // Crear mapa con tu ubicación REAL
            crearMapa(miLat, miLon, "Tu ubicación actual");
            
            // Habilitar botón de búsqueda
            document.getElementById('buscarBtn').disabled = false;
            mapaInicializado = true;
        },
        
        // ERROR
        (error) => {
            console.error("❌ Error de geolocalización:", error.message);
            
            alert(`⚠️ ${mensajeError}\n\nSe usará ubicación por defecto: ${UBICACION_POR_DEFECTO.nombre}`);
            
            // Usar ubicación por defecto
            usarUbicacionPorDefecto();
        },
        
        opciones
    );
}

/* USAR UBICACIÓN POR DEFECTO */

/* CREAR MAPA */
function crearMapa(latitud, longitud, titulo) {
    console.log(`Creando mapa centrado en: ${titulo}`);
    
    // Crear mapa
    mapa = L.map('mapa').setView([latitud, longitud], 15);
    
    // Añadir capa de tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 19
    }).addTo(mapa);
    
    // Marcador principal
    marcadorUsuario = L.marker([latitud, longitud])
        .addTo(mapa)
        .bindPopup(`<b> ${titulo}</b><br>Lat: ${latitud.toFixed(6)}<br>Lon: ${longitud.toFixed(6)}`)
        .openPopup();
    
    // Añadir círculo de precisión si es ubicación real
    if (titulo === "Tu ubicación actual") {
        L.circle([latitud, longitud], {
            color: 'blue',
            fillColor: '#30f',
            fillOpacity: 0.1,
            radius: 100  // 100 metros de radio
        }).addTo(mapa)
        .bindPopup('Área de precisión aproximada');
    }
    
    // Añadir botón para centrar en ubicación real
    L.control.locate({
        position: 'topleft',
        drawCircle: true,
        follow: true,
        setView: true,
        keepCurrentZoomLevel: true,
        markerStyle: {
            weight: 1,
            opacity: 0.8,
            fillOpacity: 0.8
        },
        circleStyle: {
            weight: 1,
            clickable: false
        },
        icon: 'fa fa-location-arrow',
        metric: true,
        strings: {
            title: "Mostrar mi ubicación",
            popup: "Estás a {distance} {unit} de este punto",
            outsideMapBoundsMsg: "Parece que estás fuera de los límites del mapa"
        },
        locateOptions: {
            maxZoom: 15,
            watch: true,
            enableHighAccuracy: true,
            maximumAge: 10000,
            timeout: 10000
        }
    }).addTo(mapa);
    
    console.log("✅ Mapa creado correctamente");
}

/* BUSCAR AMBULANCIA */
async function buscarAmbulancia() {
    if (!mapaInicializado) {
        alert("El mapa aún no está listo. Espera un momento.");
        return;
    }
    
    console.log("Buscando ambulancia...");
    console.log(`Desde ubicación: ${miLat}, ${miLon}`);
    
    try {
        const response = await fetch("http://localhost:3000/buscar-ambulancia", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                lat: miLat,
                lon: miLon,
                timestamp: new Date().toISOString()
            })
        });
        
        if (!response.ok) {
            throw new Error(`Error HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        console.log(" Respuesta del servidor:", data);
        
        if (data.ok) {
            // Mostrar ambulancia en el mapa
            mostrarAmbulanciaEnMapa(data.ambulancia, data.distancia);
            
            // Mostrar mensaje al usuario
            mostrarAlertaAmbulancia(data);
            
        } else {
            alert(`⚠️ ${data.mensaje || "No se pudo encontrar ambulancia"}`);
        }
        
    } catch (error) {
        console.error("Error al buscar ambulancia:", error);
        alert(`Error de conexión: ${error.message}\n\nAsegúrate de que:\n1. El servidor esté corriendo\n2. La URL sea correcta\n3. No haya problemas de red`);
    }
}

/* MOSTRAR AMBULANCIA EN EL MAPA */
function mostrarAmbulanciaEnMapa(ambulancia, distancia) {
    if (!mapa) return;
    
    // Limpiar marcadores previos de ambulancias
    mapa.eachLayer((layer) => {
        if (layer instanceof L.Marker && layer !== marcadorUsuario) {
            mapa.removeLayer(layer);
        }
    });
    
    // Crear marcador de ambulancia
    const iconoAmbulancia = L.divIcon({
        html: '<div style="font-size: 24px;"></div>',
        iconSize: [30, 30],
        className: 'icono-ambulancia'
    });
    
    const marcadorAmbulancia = L.marker([ambulancia.lat, ambulancia.lon], {
        icon: iconoAmbulancia
    }).addTo(mapa);
    
    // Información de la ambulancia
    const popupContent = `
        <div style="text-align: center;">
            <div style="font-size: 20px; margin-bottom: 10px;"><b>Ambulancia #${ambulancia.id}</b></div>
            <hr>
            <p><b>Estado:</b> ${ambulancia.estado || 'En camino'}</p>
            <p><b>Distancia:</b> ${distancia ? distancia.toFixed(2) + ' km' : 'Calculando...'}</p>
            <p><b>Tiempo estimado:</b> ${ambulancia.tiempo_estimado || '8-10'} minutos</p>
            <p><b>Ubicación:</b><br>
               Lat: ${ambulancia.lat.toFixed(6)}<br>
               Lon: ${ambulancia.lon.toFixed(6)}
            </p>
        </div>
    `;
    
    marcadorAmbulancia.bindPopup(popupContent).openPopup();
    
    // Dibujar línea entre usuario y ambulancia
    const polyline = L.polyline([
        [miLat, miLon],
        [ambulancia.lat, ambulancia.lon]
    ], {
        color: 'red',
        weight: 3,
        opacity: 0.7,
        dashArray: '10, 10'
    }).addTo(mapa);
    
    // Ajustar vista para ver ambos puntos
    const bounds = L.latLngBounds(
        [miLat, miLon],
        [ambulancia.lat, ambulancia.lon]
    );
    mapa.fitBounds(bounds, { padding: [50, 50] });
}

/* MOSTRAR ALERTA DE AMBULANCIA */
function mostrarAlertaAmbulancia(data) {
    const mensaje = `
        ✅ <b>¡AMBULANCIA ENCONTRADA!</b>
        
        <b>Ambulancia #${data.ambulancia.id}</b>
        <b>Distancia:</b> ${data.distancia ? data.distancia.toFixed(2) + ' km' : 'Calculando...'}
        <b>Tiempo estimado:</b> ${data.ambulancia.tiempo_estimado || '8-10'} minutos
        <b>Ubicación actual:</b> 
           Lat: ${data.ambulancia.lat.toFixed(6)}
           Lon: ${data.ambulancia.lon.toFixed(6)}
        
        <i>La ambulancia está en camino a tu ubicación.</i>
    `;
    
    // Crear alerta personalizada
    const alertDiv = document.createElement('div');
    alertDiv.innerHTML = `
        <div style="
            position: fixed;
            top: 20px;
            right: 20px;
            background: white;
            border-left: 5px solid #4CAF50;
            padding: 15px;
            border-radius: 5px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            z-index: 1000;
            max-width: 300px;
        ">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <h3 style="margin: 0; color: #4CAF50;">🚑 Ambulancia Asignada</h3>
                <button onclick="this.parentElement.parentElement.style.display='none'" 
                        style="background: none; border: none; font-size: 20px; cursor: pointer;">
                    ×
                </button>
            </div>
            <p>${mensaje.replace(/\n/g, '<br>')}</p>
        </div>
    `;
    
    document.body.appendChild(alertDiv);
    
    // También alerta simple
    alert(`🚑 ¡AMBULANCIA EN CAMINO!\n\nDistancia: ${data.distancia ? data.distancia.toFixed(2) + ' km' : 'Calculando...'}\nTiempo estimado: ${data.ambulancia.tiempo_estimado || '8-10'} minutos`);
}

/* FORZAR OBTENCIÓN DE NUEVA UBICACIÓN */
function actualizarUbicacion() {
    console.log("🔄 Actualizando ubicación...");
    
    if (mapa) {
        mapa.remove();
        document.getElementById('mapa').innerHTML = '';
    }
    
    mapaInicializado = false;
    document.getElementById('buscarBtn').disabled = true;
    
    inicializarMapa();
}

/* AGREGAR BOTÓN DE ACTUALIZAR UBICACIÓN */
function agregarBotonesAdicionales() {
    const contenedorBotones = document.createElement('div');
    contenedorBotones.style.margin = '10px auto';
    contenedorBotones.style.textAlign = 'center';
    
    contenedorBotones.innerHTML = `
        <button onclick="actualizarUbicacion()" 
                style="padding: 10px 20px; margin: 5px; background: #2196F3; color: white; border: none; border-radius: 5px; cursor: pointer;">
            🔄 Actualizar Mi Ubicación
        </button>
        <button onclick="usarUbicacionPorDefecto()" 
                style="padding: 10px 20px; margin: 5px; background: #FF9800; color: white; border: none; border-radius: 5px; cursor: pointer;">
            🗺️ Usar Ubicación por Defecto
        </button>
    `;
    
    // Insertar después del título
    const titulo = document.querySelector('h1');
    titulo.parentNode.insertBefore(contenedorBotones, titulo.nextSibling);
}

/* INICIALIZAR CUANDO EL DOM ESTÉ LISTO */
document.addEventListener('DOMContentLoaded', function() {
    console.log("🚀 Iniciando Sistema de Emergencias...");
    
    // Agregar botones adicionales
    agregarBotonesAdicionales();
    
    // Configurar botón de búsqueda
    const buscarBtn = document.getElementById('buscarBtn');
    if (buscarBtn) {
        buscarBtn.disabled = true;
        buscarBtn.addEventListener('click', buscarAmbulancia);
    }
    
    // Inicializar mapa
    setTimeout(() => {
        inicializarMapa();
    }, 500);
});

/* ESTILOS ADICIONALES PARA ICONOS */
const estilo = document.createElement('style');
estilo.textContent = `
    .icono-ambulancia {
        background: transparent;
        border: none;
    }
    .leaflet-control-locate a {
        background-color: #fff;
        background-image: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="%23333"><path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/></svg>');
        background-position: center;
        background-repeat: no-repeat;
        background-size: 60%;
    }
`;
document.head.appendChild(estilo);