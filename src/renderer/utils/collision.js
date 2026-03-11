class CollisionUtils {
  // 检测两个矩形是否碰撞
  static rectCollision(rect1, rect2) {
    return (
      rect1.x < rect2.x + rect2.width &&
      rect1.x + rect1.width > rect2.x &&
      rect1.y < rect2.y + rect2.height &&
      rect1.y + rect1.height > rect2.y
    );
  }

  // 检测点是否在矩形内
  static pointInRect(point, rect) {
    return (
      point.x >= rect.x &&
      point.x <= rect.x + rect.width &&
      point.y >= rect.y &&
      point.y <= rect.y + rect.height
    );
  }

  // 检测毛毛虫与桌面图标的碰撞
  static checkCaterpillarCollision(caterpillarRect, icons) {
    for (const icon of icons) {
      if (this.rectCollision(caterpillarRect, icon.rect)) {
        return true;
      }
    }
    return false;
  }

  // 检测毛毛虫与屏幕边界的碰撞
  static checkBoundaryCollision(caterpillarRect, screenWidth, screenHeight) {
    return {
      left: caterpillarRect.x < 0,
      right: caterpillarRect.x + caterpillarRect.width > screenWidth,
      top: caterpillarRect.y < 0,
      bottom: caterpillarRect.y + caterpillarRect.height > screenHeight
    };
  }

  // 计算两个矩形之间的距离
  static distanceBetweenRects(rect1, rect2) {
    const x1 = rect1.x + rect1.width / 2;
    const y1 = rect1.y + rect1.height / 2;
    const x2 = rect2.x + rect2.width / 2;
    const y2 = rect2.y + rect2.height / 2;
    return Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
  }

  // 找到最近的碰撞对象
  static findNearestCollision(caterpillarRect, objects) {
    let nearestObject = null;
    let minDistance = Infinity;

    for (const object of objects) {
      const distance = this.distanceBetweenRects(caterpillarRect, object.rect);
      if (distance < minDistance) {
        minDistance = distance;
        nearestObject = object;
      }
    }

    return nearestObject;
  }

  // 生成安全的移动路径，避开障碍物
  static generateSafePath(start, end, obstacles) {
    // 简化版路径规划，实际项目中可使用A*算法
    let path = [start];
    let current = start;

    while (Math.sqrt((current.x - end.x) ** 2 + (current.y - end.y) ** 2) > 10) {
      // 计算方向向量
      const dx = end.x - current.x;
      const dy = end.y - current.y;
      const magnitude = Math.sqrt(dx ** 2 + dy ** 2);
      const direction = { x: dx / magnitude, y: dy / magnitude };

      // 移动一小步
      const step = 5;
      const next = {
        x: current.x + direction.x * step,
        y: current.y + direction.y * step
      };

      // 检查是否与障碍物碰撞
      let collision = false;
      for (const obstacle of obstacles) {
        if (this.rectCollision(
          { x: next.x, y: next.y, width: 80, height: 40 },
          obstacle.rect
        )) {
          collision = true;
          break;
        }
      }

      if (!collision) {
        current = next;
        path.push(current);
      } else {
        // 如果碰撞，尝试绕开
        current.x += (Math.random() - 0.5) * 20;
        current.y += (Math.random() - 0.5) * 20;
        path.push(current);
      }
    }

    path.push(end);
    return path;
  }
}