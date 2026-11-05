//k6 run scripts/carga-k6.js

import http from 'k6/http';
import { check } from 'k6';
import { Trend, Rate } from 'k6/metrics';

const tiempoRespuesta = new Trend('respuesta_eventos_ms');
const respuestasCorrectas = new Rate('respuestas_correctas');
export const options = {
  vus: 20,
  duration: '20s',
  thresholds: {
    http_req_failed: ['rate<0.05'],
    http_req_duration: ['p(95)<2000'],
  },
};

export default function () {
  const resultado = http.get(`${__ENV.BASE_URL || 'http://localhost:3000'}/api/events`);
  const respuestaCorrecta = check(resultado, {
    'HTTP 200': (respuesta) => respuesta.status === 200,
  });
  respuestasCorrectas.add(respuestaCorrecta);
  tiempoRespuesta.add(resultado.timings.duration);
}
