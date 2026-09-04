import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const ESTILO_PADRAO = { fillColor: '#d9d9d9', color: '#ffffff', weight: 1.5, fillOpacity: 0.9 };
const ESTILO_HOVER = { fillColor: '#ffb98a', color: '#ffffff', weight: 1.5, fillOpacity: 0.95 };
const ESTILO_SELECIONADO = { fillColor: '#ff7b33', color: '#ffffff', weight: 2, fillOpacity: 1 };

export class MapaBairros {
  constructor(containerId, { onChange, selecionadosIniciais = [] } = {}) {
    this.containerId = containerId;
    this.onChange = onChange;
    this.selecionados = new Set(selecionadosIniciais);
    this.map = null;
    this.layer = null;
    this.layersPorBairro = new Map();
    this.carregado = false;
  }

  async carregar() {
    if (this.carregado) return;
    this.carregado = true;

    const container = document.getElementById(this.containerId);
    if (!container) return;

    this.map = L.map(this.containerId, {
      attributionControl: false,
      zoomControl: true,
      scrollWheelZoom: true
    });
    container.style.background = '#ffffff';

    let geo;
    try {
      const res = await fetch('/data/bairros-maceio.geojson');
      geo = await res.json();
    } catch (err) {
      console.error('Erro ao carregar mapa de bairros:', err);
      container.innerHTML = '<p style="padding:20px;color:#666;">Não foi possível carregar o mapa. Recarregue a página.</p>';
      return;
    }

    this.layer = L.geoJSON(geo, {
      style: () => ({ ...ESTILO_PADRAO }),
      onEachFeature: (feature, lyr) => {
        const nome = feature.properties.bairro;
        this.layersPorBairro.set(nome, lyr);

        lyr.bindTooltip(nome, { sticky: true, direction: 'top' });

        if (this.selecionados.has(nome)) lyr.setStyle(ESTILO_SELECIONADO);

        lyr.on('mouseover', () => {
          if (!this.selecionados.has(nome)) lyr.setStyle(ESTILO_HOVER);
        });
        lyr.on('mouseout', () => {
          if (!this.selecionados.has(nome)) lyr.setStyle(ESTILO_PADRAO);
        });
        lyr.on('click', () => this.toggleBairro(nome));
      }
    }).addTo(this.map);

    const bounds = this.layer.getBounds();
    this.map.fitBounds(bounds, { padding: [10, 10] });
    this.map.setMaxBounds(bounds.pad(0.15));
    const baseZoom = this.map.getZoom();
    this.map.setMinZoom(baseZoom);
    this.map.setMaxZoom(baseZoom + 4);

    // Garante que o Leaflet recalcule as dimensões após entrar em uma seção que estava com display:none
    requestAnimationFrame(() => {
      this.map.invalidateSize();
      this.map.fitBounds(bounds, { padding: [10, 10] });
    });
  }

  toggleBairro(nome) {
    const lyr = this.layersPorBairro.get(nome);
    if (!lyr) return;
    if (this.selecionados.has(nome)) {
      this.selecionados.delete(nome);
      lyr.setStyle(ESTILO_PADRAO);
    } else {
      this.selecionados.add(nome);
      lyr.setStyle(ESTILO_SELECIONADO);
    }
    this.onChange?.(this.getSelecionados());
  }

  getSelecionados() {
    return Array.from(this.selecionados);
  }

  invalidateSize() {
    this.map?.invalidateSize();
  }
}
