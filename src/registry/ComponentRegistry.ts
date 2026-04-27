import { ComponentType } from 'react';

interface ComponentMap {
  [key: string]: ComponentType<any>;
}

class ComponentRegistry {
  private components: Map<string, ComponentType<any>> = new Map();
  private defaultComponents: Map<string, ComponentType<any>> = new Map();

  /**
   * Регистрирует компонент в registry
   */
  register<T = any>(
    name: string,
    component: ComponentType<T>,
    isDefault: boolean = false
  ): void {
    if (isDefault) {
      this.defaultComponents.set(name, component);
    }

    this.components.set(name, component);
  }

  /**
   * Получает компонент из registry
   */
  get<T = any>(name: string): ComponentType<T> | null {
    const component = this.components.get(name);
    if (!component) {
      return null;
    }
    return component as ComponentType<T>;
  }

  /**
   * Проверяет наличие компонента
   */
  has(name: string): boolean {
    return this.components.has(name);
  }

  /**
   * Получает компонент ядра (до переопределения)
   */
  getDefault<T = any>(name: string): ComponentType<T> | null {
    return (this.defaultComponents.get(name) as ComponentType<T>) || null;
  }

  /**
   * Проверяет, был ли компонент переопределён
   */
  isOverridden(name: string): boolean {
    const current = this.components.get(name);
    const defaultComp = this.defaultComponents.get(name);
    return current !== defaultComp;
  }

  /**
   * Массовая регистрация компонентов
   */
  registerBatch(components: ComponentMap, isDefault: boolean = false): void {
    Object.entries(components).forEach(([name, component]) => {
      this.register(name, component, isDefault);
    });
  }

  /**
   * Список всех зарегистрированных компонентов
   */
  list(): string[] {
    return Array.from(this.components.keys());
  }

  /**
   * Список переопределённых компонентов
   */
  listOverridden(): string[] {
    return this.list().filter(name => this.isOverridden(name));
  }
}

// Singleton instance
export const componentRegistry = new ComponentRegistry();

