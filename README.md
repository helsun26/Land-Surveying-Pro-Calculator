const state = {
  distanceUnit: 'm',
  angleUnit: 'deg',
  precision: 4,
  stationRows: [],
  loadedPoints: [],
};

function getPrecision() {
  return Number(document.getElementById('precision').value || 4);
}

function roundNumber(value, digits = getPrecision()) {
  if (!Number.isFinite(value)) return '—';
  return Number(value).toFixed(digits);
}

function normalizeAngle(value) {
  const angle = Number(value);
  if (!Number.isFinite(angle)) return 0;
  return ((angle % 360) + 360) % 360;
}

function toRadians(value) {
  return (value * Math.PI) / 180;
}

function toDegrees(value) {
  return (value * 180) / Math.PI;
}

function ensureNumber(value, label) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    throw new Error(`${label} must be a valid number.`);
  }
  return number;
}

function fromSelectedDistance(value) {
  if (state.distanceUnit === 'ft') {
    return value / 3.28084;
  }
  return value;
}

function toSelectedDistance(value) {
  if (state.distanceUnit === 'ft') {
    return value * 3.28084;
  }
  return value;
}

function toSelectedAngle(valueDegrees) {
  if (state.angleUnit === 'rad') {
    return toRadians(valueDegrees);
  }
  return valueDegrees;
}

function fromSelectedAngle(valueAngle) {
  if (state.angleUnit === 'rad') {
    return toDegrees(valueAngle);
  }
  return valueAngle;
}

function formatDistance(value) {
  return roundNumber(toSelectedDistance(value));
}

function formatAngle(value) {
  const finalValue = fromSelectedAngle(value);
  return roundNumber(finalValue);
}

function calcCoordinateFromBearing(startX, startY, bearingDeg, distance) {
  const distanceValue = ensureNumber(distance, 'Distance');
  if (distanceValue < 0) {
    throw new Error('Distance cannot be negative.');
  }

  const bearing = normalizeAngle(bearingDeg);
  const angle = toRadians(bearing);

  const endX = startX + distanceValue * Math.cos(angle);
  const endY = startY + distanceValue * Math.sin(angle);

  return {
    x: endX,
    y: endY,
    bearing: bearing,
    distance: distanceValue,
  };
}

function calcBearingBetweenPoints(pointA, pointB) {
  const dx = pointB.x - pointA.x;
  const dy = pointB.y - pointA.y;
  const theta = Math.atan2(dy, dx);
  return normalizeAngle(toDegrees(theta));
}

function calcDistanceBetweenPoints(pointA, pointB) {
  const dx = pointB.x - pointA.x;
  const dy = pointB.y - pointA.y;
  return Math.hypot(dx, dy);
}

function offsetPoint(basePoint, baseBearingDeg, offset, side) {
  const offsetValue = Number(offset);
  if (!Number.isFinite(offsetValue)) {
    throw new Error('Offset must be a valid number.');
  }

  const direction = side === 'left' ? 1 : -1;
  const perpendicular = toRadians(baseBearingDeg + direction * 90);

  return {
    x: basePoint.x + offsetValue * Math.cos(perpendicular),
    y: basePoint.y + offsetValue * Math.sin(perpendicular),
  };
}

function calcHeightFromSlope(horizontalDistance, startRL, inputValue, mode) {
  const distance = ensureNumber(horizontalDistance, 'Horizontal Distance');
  const rl = ensureNumber(startRL, 'Starting RL');

  if (distance < 0) {
    throw new Error('Horizontal distance cannot be negative.');
  }

  const value = ensureNumber(inputValue, 'Slope Value');

  let rise = 0;
  let gradePercent = 0;
  let slopeAngle = 0;

  if (mode === 'angle') {
    slopeAngle = normalizeAngle(value);
    rise = distance * Math.tan(toRadians(slopeAngle));
    gradePercent = Math.tan(toRadians(slopeAngle)) * 100;
  } else {
    gradePercent = value;
    slopeAngle = toDegrees(Math.atan(value / 100));
    rise = distance * Math.tan(toRadians(slopeAngle));
  }

  const endRL = rl + rise;

  return {
    rise,
    slopeAngle,
    gradePercent,
    endRL,
  };
}

function parseTraverseLegs(inputText) {
  const lines = inputText
    .split(/\n|;/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (lines.length === 0) {
    throw new Error('Please enter at least one traverse leg.');
  }

  const legs = lines.map((line, index) => {
    const parts = line.split(/[\s,]+/).filter(Boolean);
    if (parts.length < 2) {
      throw new Error(`Leg ${index + 1} must be in the format: bearing, distance`);
    }

    const bearing = ensureNumber(parts[0], `Leg ${index + 1} bearing`);
    const distance = ensureNumber(parts[1], `Leg ${index + 1} distance`);

    if (distance < 0) {
      throw new Error(`Leg ${index + 1} distance cannot be negative.`);
    }

    return {
      bearing: normalizeAngle(bearing),
      distance,
    };
  });

  return legs;
}

function calcTraverseClosure(legs) {
  let currentX = 0;
  let currentY = 0;
  let totalDistance = 0;

  for (const leg of legs) {
    const angle = toRadians(leg.bearing);
    currentX += leg.distance * Math.cos(angle);
    currentY += leg.distance * Math.sin(angle);
    totalDistance += leg.distance;
  }

  const closure = Math.hypot(currentX, currentY);
  const relativePrecision = totalDistance > 0 ? closure / totalDistance : 0;

  return {
    dx: currentX,
    dy: currentY,
    closure,
    totalDistance,
    relativePrecision,
    finalPoint: { x: currentX, y: currentY },
  };
}

function createStationTable(startPoint, endPoint, interval, offset, side, stationStart) {
  const start = {
    x: ensureNumber(startPoint.x, 'Baseline start X'),
    y: ensureNumber(startPoint.y, 'Baseline start Y'),
  };

  const end = {
    x: ensureNumber(endPoint.x, 'Baseline end X'),
    y: ensureNumber(endPoint.y, 'Baseline end Y'),
  };

  const intervalValue = ensureNumber(interval, 'Interval');
  const offsetValue = ensureNumber(offset, 'Offset');
  const stationStartValue = ensureNumber(stationStart, 'Station Start');

  if (intervalValue <= 0) {
    throw new Error('Interval must be greater than zero.');
  }

  const baselineBearing = calcBearingBetweenPoints(start, end);
  const totalLength = calcDistanceBetweenPoints(start, end);
  const stations = [];
  const count = Math.floor(totalLength / intervalValue);

  for (let i = 0; i <= count; i += 1) {
    const chainage = i * intervalValue;
    const ratio = totalLength > 0 ? chainage / totalLength : 0;
    const basePoint = {
      x: start.x + (end.x - start.x) * ratio,
      y: start.y + (end.y - start.y) * ratio,
    };

    const offsetPointResult = offsetPoint(basePoint, baselineBearing, offsetValue, side);
    stations.push({
      station: stationStartValue + i * intervalValue,
      chainage,
      offsetX: offsetPointResult.x,
      offsetY: offsetPointResult.y,
    });
  }

  return stations;
}

function setResult(elementId, html) {
  const container = document.getElementById(elementId);
  if (!container) return;
  container.innerHTML = html;
}

function renderStationTable(rows) {
  const tbody = document.querySelector('#stationTable tbody');
  if (!tbody) return;

  tbody.innerHTML = rows
    .map(
      (row) => `
        <tr>
          <td>${roundNumber(row.station, getPrecision())}</td>
          <td>${formatDistance(row.chainage)}</td>
          <td>${formatDistance(row.offsetX)}</td>
          <td>${formatDistance(row.offsetY)}</td>
        </tr>
      `
    )
    .join('');
}

function exportCsv(filename, rows) {
  const csvRows = rows.map((row) => Object.values(row).map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','));
  const csvContent = csvRows.join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);

  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function parseBatchPoints() {
  const textarea = document.getElementById('batchPointsInput');
  const lines = textarea.value
    .split(/\n|;/)
    .map((line) => line.trim())
    .filter(Boolean);

  const points = lines.map((line) => {
    const parts = line.split(/[\s,]+/).filter(Boolean);
    if (parts.length < 2) {
      throw new Error('Each batch point must be in the format: x,y');
    }
    return {
      x: ensureNumber(parts[0], 'X coordinate'),
      y: ensureNumber(parts[1], 'Y coordinate'),
    };
  });

  if (!points.length) {
    throw new Error('Please add at least one point in the batch list.');
  }

  state.loadedPoints = points;
  return points;
}

function buildSummaryCsv() {
  const rows = [
    ['measurement', 'value'],
    ['distance_unit', state.distanceUnit],
    ['angle_unit', state.angleUnit],
    ['precision', getPrecision()],
  ];

  if (state.stationRows.length) {
    rows.push(['station_count', state.stationRows.length]);
    rows.push(['first_station', state.stationRows[0].station]);
    rows.push(['last_station', state.stationRows[state.stationRows.length - 1].station]);
  }

  return rows;
}

function readDistanceInput(elementId) {
  return fromSelectedDistance(ensureNumber(document.getElementById(elementId).value, 'Distance'));
}

function readAngleInput(elementId) {
  const raw = ensureNumber(document.getElementById(elementId).value, 'Angle');
  return fromSelectedAngle(raw);
}

function readDistanceInputForDisplay(elementId) {
  return toSelectedDistance(ensureNumber(document.getElementById(elementId).value, 'Distance'));
}

function registerUnitSync() {
  document.getElementById('distanceUnit').addEventListener('change', (event) => {
    state.distanceUnit = event.target.value;
    renderStationTable(state.stationRows);
  });

  document.getElementById('angleUnit').addEventListener('change', (event) => {
    state.angleUnit = event.target.value;
    document.getElementById('coordResult').innerHTML = '<span class="warning">Angle format has been updated. Please recalculate for the most recent values.</span>';
  });

  document.getElementById('precision').addEventListener('change', () => {
    renderStationTable(state.stationRows);
  });
}

document.getElementById('coordBtn').addEventListener('click', () => {
  try {
    const startX = ensureNumber(document.getElementById('coordStartX').value, 'Start X');
    const startY = ensureNumber(document.getElementById('coordStartY').value, 'Start Y');
    const bearing = readAngleInput('coordBearing');
    const distance = readDistanceInput('coordDistance');

    const result = calcCoordinateFromBearing(startX, startY, bearing, distance);
    setResult(
      'coordResult',
      `
        <strong>Result:</strong><br>
        Final Easting (X): <span class="success">${formatDistance(result.x)}</span> ${state.distanceUnit}<br>
        Final Northing (Y): <span class="success">${formatDistance(result.y)}</span> ${state.distanceUnit}<br>
        Bearing: <span class="success">${formatAngle(result.bearing)} ${state.angleUnit}</span><br>
        Distance: <span class="success">${formatDistance(result.distance)}</span> ${state.distanceUnit}
      `
    );
  } catch (error) {
    setResult('coordResult', `<span class="error">${error.message}</span>`);
  }
});

document.getElementById('pointBtn').addEventListener('click', () => {
  try {
    const pointA = {
      x: ensureNumber(document.getElementById('pointAX').value, 'Point A X'),
      y: ensureNumber(document.getElementById('pointAY').value, 'Point A Y'),
    };

    const pointB = {
      x: ensureNumber(document.getElementById('pointBX').value, 'Point B X'),
      y: ensureNumber(document.getElementById('pointBY').value, 'Point B Y'),
    };

    const bearing = calcBearingBetweenPoints(pointA, pointB);
    const distance = calcDistanceBetweenPoints(pointA, pointB);

    setResult(
      'pointResult',
      `
        <strong>Result:</strong><br>
        Bearing from A to B: <span class="success">${formatAngle(bearing)} ${state.angleUnit}</span><br>
        Horizontal Distance: <span class="success">${formatDistance(distance)}</span> ${state.distanceUnit}
      `
    );
  } catch (error) {
    setResult('pointResult', `<span class="error">${error.message}</span>`);
  }
});

document.getElementById('stationBtn').addEventListener('click', () => {
  try {
    const start = {
      x: ensureNumber(document.getElementById('lineStartX').value, 'Baseline start X'),
      y: ensureNumber(document.getElementById('lineStartY').value, 'Baseline start Y'),
    };

    const end = {
      x: ensureNumber(document.getElementById('lineEndX').value, 'Baseline end X'),
      y: ensureNumber(document.getElementById('lineEndY').value, 'Baseline end Y'),
    };

    const interval = readDistanceInput('stationInterval');
    const offset = readDistanceInput('offsetDistance');
    const side = document.getElementById('offsetSide').value;
    const stationStart = ensureNumber(document.getElementById('stationStart').value, 'Station Start');

    state.stationRows = createStationTable(start, end, interval, offset, side, stationStart);
    const totalLength = calcDistanceBetweenPoints(start, end);
    const baselineBearing = calcBearingBetweenPoints(start, end);

    setResult(
      'stationResult',
      `
        <strong>Baseline Summary:</strong><br>
        Total Length: <span class="success">${formatDistance(totalLength)}</span> ${state.distanceUnit}<br>
        Bearing: <span class="success">${formatAngle(baselineBearing)} ${state.angleUnit}</span><br>
        Offset Side: <span class="success">${side}</span>
      `
    );

    renderStationTable(state.stationRows);
  } catch (error) {
    setResult('stationResult', `<span class="error">${error.message}</span>`);
    renderStationTable([]);
  }
});

document.getElementById('heightBtn').addEventListener('click', () => {
  try {
    const horizontalDistance = readDistanceInput('heightDistance');
    const startRL = ensureNumber(document.getElementById('heightStartRL').value, 'Starting RL');
    const mode = document.getElementById('heightMode').value;
    const value = ensureNumber(document.getElementById('heightValue').value, 'Slope Value');

    const result = calcHeightFromSlope(horizontalDistance, startRL, value, mode);

    setResult(
      'heightResult',
      `
        <strong>Height Result:</strong><br>
        Rise / Fall: <span class="success">${formatDistance(result.rise)}</span> ${state.distanceUnit}<br>
        Final RL: <span class="success">${roundNumber(result.endRL)}</span><br>
        Slope Angle: <span class="success">${formatAngle(result.slopeAngle)} ${state.angleUnit}</span><br>
        Grade: <span class="success">${roundNumber(result.gradePercent)}%</span>
      `
    );
  } catch (error) {
    setResult('heightResult', `<span class="error">${error.message}</span>`);
  }
});

document.getElementById('traverseBtn').addEventListener('click', () => {
  try {
    const inputValue = document.getElementById('traverseInput').value;
    const legs = parseTraverseLegs(inputValue);
    const result = calcTraverseClosure(legs);

    setResult(
      'traverseResult',
      `
        <strong>Traverse Closure:</strong><br>
        Final ΔX: <span class="success">${formatDistance(result.dx)}</span> ${state.distanceUnit}<br>
        Final ΔY: <span class="success">${formatDistance(result.dy)}</span> ${state.distanceUnit}<br>
        Closure Error: <span class="success">${formatDistance(result.closure)}</span> ${state.distanceUnit}<br>
        Relative Precision: <span class="success">${roundNumber(result.relativePrecision, 8)}</span>
      `
    );
  } catch (error) {
    setResult('traverseResult', `<span class="error">${error.message}</span>`);
  }
});

document.getElementById('loadBatchBtn').addEventListener('click', () => {
  try {
    const points = parseBatchPoints();
    setResult('coordResult', `<span class="success">Loaded ${points.length} points from batch input.</span>`);
  } catch (error) {
    setResult('coordResult', `<span class="error">${error.message}</span>`);
  }
});

document.getElementById('exportBatchBtn').addEventListener('click', () => {
  try {
    const points = parseBatchPoints();
    const rows = points.map((point) => ({ x: formatDistance(point.x), y: formatDistance(point.y) }));
    exportCsv('batch_points.csv', rows.map((row) => ({ x: row.x, y: row.y })));
  } catch (error) {
    setResult('coordResult', `<span class="error">${error.message}</span>`);
  }
});

document.getElementById('exportStationBtn').addEventListener('click', () => {
  if (!state.stationRows.length) {
    setResult('stationResult', '<span class="warning">Generate station points first before exporting.</span>');
    return;
  }

  const rows = state.stationRows.map((row) => ({
    Station: roundNumber(row.station),
    Chainage: formatDistance(row.chainage),
    OffsetX: formatDistance(row.offsetX),
    OffsetY: formatDistance(row.offsetY),
  }));

  exportCsv('station_points.csv', rows);
});

document.getElementById('exportSummaryBtn').addEventListener('click', () => {
  const rows = buildSummaryCsv();
  exportCsv('survey_summary.csv', rows.map(([key, value]) => ({ key, value })));
});

registerUnitSync();
renderStationTable([]);
