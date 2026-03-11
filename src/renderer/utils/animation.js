class AnimationUtils {
  // 缓动函数
  static easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  static easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  static easeInCubic(t) {
    return t * t * t;
  }

  // 执行动画
  static animate(element, properties, duration, easing = this.easeInOutCubic) {
    return new Promise((resolve) => {
      const startValues = {};
      const startTime = Date.now();

      // 记录初始值
      for (const prop in properties) {
        startValues[prop] = parseFloat(getComputedStyle(element)[prop]) || 0;
      }

      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        const easedProgress = easing(progress);

        // 更新属性
        for (const prop in properties) {
          const startValue = startValues[prop];
          const targetValue = properties[prop];
          const currentValue = startValue + (targetValue - startValue) * easedProgress;
          element.style[prop] = currentValue + (prop === 'opacity' ? '' : 'px');
        }

        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          resolve();
        }
      };

      animate();
    });
  }

  // 毛毛虫移动动画
  static crawlAnimation(element, distance, duration) {
    return this.animate(element, {
      transform: `translateX(${distance}px)`
    }, duration);
  }

  // 毛毛虫身体摆动动画
  static bodyWaveAnimation(element) {
    let isWaving = true;
    let direction = 1;
    let position = 0;

    const animate = () => {
      if (!isWaving) return;

      position += direction * 0.5;
      if (position > 2 || position < -2) {
        direction *= -1;
      }

      element.style.transform = `translateY(${position}px)`;
      requestAnimationFrame(animate);
    };

    animate();

    return () => {
      isWaving = false;
    };
  }

  // 触角摆动动画
  static antennaWaveAnimation(element) {
    let isWaving = true;
    let angle = -30;
    let direction = 1;

    const animate = () => {
      if (!isWaving) return;

      angle += direction * 2;
      if (angle > -10 || angle < -30) {
        direction *= -1;
      }

      element.style.transform = `rotate(${angle}deg)`;
      requestAnimationFrame(animate);
    };

    animate();

    return () => {
      isWaving = false;
    };
  }

  // 腿部移动动画
  static legMoveAnimation(element, delay) {
    let isMoving = true;
    let angle = 0;
    let direction = 1;

    setTimeout(() => {
      const animate = () => {
        if (!isMoving) return;

        angle += direction * 3;
        if (angle > 30 || angle < 0) {
          direction *= -1;
        }

        element.style.transform = `rotate(${angle}deg)`;
        requestAnimationFrame(animate);
      };

      animate();
    }, delay);

    return () => {
      isMoving = false;
    };
  }

  // 点击动画
  static tapAnimation(element) {
    return new Promise((resolve) => {
      const variableName = '--pet-scale';
      const initialScale = parseFloat(getComputedStyle(element).getPropertyValue(variableName)) || 1;
      const pressedScale = 0.9;
      const duration = 100;

      const animateScale = (from, to, onDone) => {
        const startTime = Date.now();

        const step = () => {
          const elapsed = Date.now() - startTime;
          const progress = Math.min(elapsed / duration, 1);
          const easedProgress = this.easeOutCubic(progress);
          const currentScale = from + (to - from) * easedProgress;

          element.style.setProperty(variableName, String(currentScale));

          if (progress < 1) {
            requestAnimationFrame(step);
            return;
          }

          onDone();
        };

        step();
      };

      animateScale(initialScale, pressedScale, () => {
        animateScale(pressedScale, initialScale, resolve);
      });
    });
  }

  // 淡入动画
  static fadeIn(element, duration = 300) {
    element.style.opacity = '0';
    element.style.display = 'block';
    return this.animate(element, {
      opacity: 1
    }, duration);
  }

  // 淡出动画
  static fadeOut(element, duration = 300) {
    return this.animate(element, {
      opacity: 0
    }, duration).then(() => {
      element.style.display = 'none';
    });
  }
}
