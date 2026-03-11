class PathfindingUtils {
  static PET_WIDTH = 80;
  static PET_HEIGHT = 40;

  static clampPoint(point, screenWidth, screenHeight) {
    return {
      x: Math.max(0, Math.min(screenWidth - this.PET_WIDTH, point.x)),
      y: Math.max(0, Math.min(screenHeight - this.PET_HEIGHT, point.y))
    };
  }

  static generateRandomPath(start, screenWidth, screenHeight) {
    const safeStart = this.clampPoint(start, screenWidth, screenHeight);
    const target = {
      x: 48 + Math.random() * Math.max(48, screenWidth - this.PET_WIDTH - 96),
      y: 48 + Math.random() * Math.max(48, screenHeight - this.PET_HEIGHT - 96)
    };

    return this.generateTargetPath(safeStart, target, screenWidth, screenHeight);
  }

  static generateTargetPath(start, target, screenWidth = window.innerWidth, screenHeight = window.innerHeight) {
    const safeStart = this.clampPoint(start, screenWidth, screenHeight);
    const safeTarget = this.clampPoint(target, screenWidth, screenHeight);
    const dx = safeTarget.x - safeStart.x;
    const dy = safeTarget.y - safeStart.y;
    const distance = Math.sqrt(dx ** 2 + dy ** 2) || 1;
    const normal = { x: -dy / distance, y: dx / distance };
    const curveStrength = Math.min(56, Math.max(18, distance * 0.18)) * (Math.random() > 0.5 ? 1 : -1);
    const midpoint = this.clampPoint({
      x: safeStart.x + dx * 0.5 + normal.x * curveStrength,
      y: safeStart.y + dy * 0.5 + normal.y * curveStrength
    }, screenWidth, screenHeight);

    return [safeStart, midpoint, safeTarget];
  }

  static smoothPath(path, resolution = 6) {
    if (!Array.isArray(path) || path.length <= 2) {
      return path || [];
    }

    const smoothed = [];

    for (let i = 0; i < path.length - 1; i += 1) {
      const p0 = path[Math.max(0, i - 1)];
      const p1 = path[i];
      const p2 = path[i + 1];
      const p3 = path[Math.min(path.length - 1, i + 2)];

      for (let step = 0; step < resolution; step += 1) {
        const t = step / resolution;
        smoothed.push(this.catmullRomPoint(p0, p1, p2, p3, t));
      }
    }

    smoothed.push(path[path.length - 1]);
    return smoothed;
  }

  static catmullRomPoint(p0, p1, p2, p3, t) {
    const t2 = t * t;
    const t3 = t2 * t;

    return {
      x: 0.5 * ((2 * p1.x) + (-p0.x + p2.x) * t + (2 * p0.x - 5 * p1.x + 4 * p2.x - p3.x) * t2 + (-p0.x + 3 * p1.x - 3 * p2.x + p3.x) * t3),
      y: 0.5 * ((2 * p1.y) + (-p0.y + p2.y) * t + (2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 + (-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3)
    };
  }

  static isPathValid(path, obstacles, screenWidth, screenHeight) {
    for (const point of path) {
      if (point.x < 0 || point.x > screenWidth - this.PET_WIDTH || point.y < 0 || point.y > screenHeight - this.PET_HEIGHT) {
        return false;
      }

      for (const obstacle of obstacles) {
        if (CollisionUtils.rectCollision(
          { x: point.x, y: point.y, width: this.PET_WIDTH, height: this.PET_HEIGHT },
          obstacle.rect
        )) {
          return false;
        }
      }
    }

    return true;
  }

  static optimizePath(path, obstacles, screenWidth, screenHeight) {
    let optimizedPath = [path[0]];

    for (let i = 1; i < path.length; i += 1) {
      const current = path[i];
      const last = optimizedPath[optimizedPath.length - 1];

      if (this.isDirectPathValid(last, current, obstacles, screenWidth, screenHeight)) {
        optimizedPath[optimizedPath.length - 1] = current;
      } else {
        optimizedPath.push(current);
      }
    }

    return optimizedPath;
  }

  static isDirectPathValid(start, end, obstacles, screenWidth, screenHeight) {
    const steps = 20;

    for (let i = 1; i <= steps; i += 1) {
      const t = i / steps;
      const point = {
        x: start.x + (end.x - start.x) * t,
        y: start.y + (end.y - start.y) * t
      };

      if (point.x < 0 || point.x > screenWidth - this.PET_WIDTH || point.y < 0 || point.y > screenHeight - this.PET_HEIGHT) {
        return false;
      }

      for (const obstacle of obstacles) {
        if (CollisionUtils.rectCollision(
          { x: point.x, y: point.y, width: this.PET_WIDTH, height: this.PET_HEIGHT },
          obstacle.rect
        )) {
          return false;
        }
      }
    }

    return true;
  }

  static aStarPathfinding(start, end, obstacles, screenWidth, screenHeight) {
    const openSet = [start];
    const closedSet = [];
    const cameFrom = {};
    const gScore = { [`${start.x},${start.y}`]: 0 };
    const fScore = { [`${start.x},${start.y}`]: this.heuristic(start, end) };

    while (openSet.length > 0) {
      let current = openSet[0];
      for (const node of openSet) {
        if (fScore[`${node.x},${node.y}`] < fScore[`${current.x},${current.y}`]) {
          current = node;
        }
      }

      if (Math.sqrt((current.x - end.x) ** 2 + (current.y - end.y) ** 2) < 10) {
        return this.reconstructPath(cameFrom, current);
      }

      openSet.splice(openSet.indexOf(current), 1);
      closedSet.push(current);

      const neighbors = this.getNeighbors(current, screenWidth, screenHeight);
      for (const neighbor of neighbors) {
        if (closedSet.some((node) => node.x === neighbor.x && node.y === neighbor.y)) {
          continue;
        }

        if (obstacles.some((obstacle) => CollisionUtils.rectCollision(
          { x: neighbor.x, y: neighbor.y, width: this.PET_WIDTH, height: this.PET_HEIGHT },
          obstacle.rect
        ))) {
          continue;
        }

        const tentativeGScore = gScore[`${current.x},${current.y}`] + this.heuristic(current, neighbor);
        if (!openSet.some((node) => node.x === neighbor.x && node.y === neighbor.y)) {
          openSet.push(neighbor);
        } else if (tentativeGScore >= (gScore[`${neighbor.x},${neighbor.y}`] || Infinity)) {
          continue;
        }

        cameFrom[`${neighbor.x},${neighbor.y}`] = current;
        gScore[`${neighbor.x},${neighbor.y}`] = tentativeGScore;
        fScore[`${neighbor.x},${neighbor.y}`] = tentativeGScore + this.heuristic(neighbor, end);
      }
    }

    return this.generateRandomPath(start, screenWidth, screenHeight);
  }

  static heuristic(a, b) {
    return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
  }

  static getNeighbors(node, screenWidth, screenHeight) {
    const step = 20;
    const neighbors = [];
    const directions = [
      { x: -step, y: 0 },
      { x: step, y: 0 },
      { x: 0, y: -step },
      { x: 0, y: step }
    ];

    for (const direction of directions) {
      const next = { x: node.x + direction.x, y: node.y + direction.y };
      if (next.x >= 0 && next.x <= screenWidth - this.PET_WIDTH && next.y >= 0 && next.y <= screenHeight - this.PET_HEIGHT) {
        neighbors.push(next);
      }
    }

    return neighbors;
  }

  static reconstructPath(cameFrom, current) {
    const path = [current];
    while (cameFrom[`${current.x},${current.y}`]) {
      current = cameFrom[`${current.x},${current.y}`];
      path.unshift(current);
    }
    return path;
  }
}
