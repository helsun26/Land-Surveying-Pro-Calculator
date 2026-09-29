function roundNumber(value, digits = 4) {
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
  if (!container) {
    return;
  }

  container.innerHTML = html;
}

function renderStationTable(rows) {
  const tbody = document.querySelector('#stationTable tbody');
  if (!tbody) return;

  tbody.innerHTML = rows
    .map(
      (row) => `
        <tr>
          <td>${roundNumber(row.station, 2)}</td>
          <td>${roundNumber(row.chainage, 2)}</td>
          <td>${roundNumber(row.offsetX, 4)}</td>
          <td>${roundNumber(row.offsetY, 4)}</td>
        </tr>
      `
    )
    .join('');
}

document.getElementById('coordBtn').addEventListener('click', () => {
  try {
    const startX = ensureNumber(document.getElementById('coordStartX').value, 'Start X');
    const startY = ensureNumber(document.getElementById('coordStartY').value, 'Start Y');
    const bearing = ensureNumber(document.getElementById('coordBearing').value, 'Bearing');
    const distance = ensureNumber(document.getElementById('coordDistance').value, 'Distance');

    const result = calcCoordinateFromBearing(startX, startY, bearing, distance);
    setResult(
      'coordResult',
      `
        <strong>Result:</strong><br>
        Final Easting (X): <span class="success">${roundNumber(result.x, 4)}</span><br>
        Final Northing (Y): <span class="success">${roundNumber(result.y, 4)}</span><br>
        Bearing: <span class="success">${roundNumber(result.bearing, 4)}°</span><br>
        Distance: <span class="success">${roundNumber(result.distance, 4)}</span>
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
        Bearing from A to B: <span class="success">${roundNumber(bearing, 4)}°</span><br>
        Horizontal Distance: <span class="success">${roundNumber(distance, 4)}</span>
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

    const interval = ensureNumber(document.getElementById('stationInterval').value, 'Interval');
    const offset = ensureNumber(document.getElementById('offsetDistance').value, 'Offset');
    const side = document.getElementById('offsetSide').value;
    const stationStart = ensureNumber(document.getElementById('stationStart').value, 'Station Start');

    const rows = createStationTable(start, end, interval, offset, side, stationStart);
    const totalLength = calcDistanceBetweenPoints(start, end);
    const baselineBearing = calcBearingBetweenPoints(start, end);

    setResult(
      'stationResult',
      `
        <strong>Baseline Summary:</strong><br>
        Total Length: <span class="success">${roundNumber(totalLength, 4)}</span><br>
        Bearing: <span class="success">${roundNumber(baselineBearing, 4)}°</span><br>
        Offset Side: <span class="success">${side}</span>
      `
    );

    renderStationTable(rows);
  } catch (error) {
    setResult('stationResult', `<span class="error">${error.message}</span>`);
    renderStationTable([]);
  }
});

document.getElementById('heightBtn').addEventListener('click', () => {
  try {
    const horizontalDistance = ensureNumber(document.getElementById('heightDistance').value, 'Horizontal Distance');
    const startRL = ensureNumber(document.getElementById('heightStartRL').value, 'Starting RL');
    const mode = document.getElementById('heightMode').value;
    const value = ensureNumber(document.getElementById('heightValue').value, 'Slope Value');

    const result = calcHeightFromSlope(horizontalDistance, startRL, value, mode);

    setResult(
      'heightResult',
      `
        <strong>Height Result:</strong><br>
        Rise / Fall: <span class="success">${roundNumber(result.rise, 4)}</span><br>
        Final RL: <span class="success">${roundNumber(result.endRL, 4)}</span><br>
        Slope Angle: <span class="success">${roundNumber(result.slopeAngle, 4)}°</span><br>
        Grade: <span class="success">${roundNumber(result.gradePercent, 4)}%</span>
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
        Final ΔX: <span class="success">${roundNumber(result.dx, 4)}</span><br>
        Final ΔY: <span class="success">${roundNumber(result.dy, 4)}</span><br>
        Closure Error: <span class="success">${roundNumber(result.closure, 4)}</span><br>
        Relative Precision: <span class="success">${roundNumber(result.relativePrecision, 8)}</span>
      `
    );
  } catch (error) {
    setResult('traverseResult', `<span class="error">${error.message}</span>`);
  }
});

renderStationTable([]);




















































