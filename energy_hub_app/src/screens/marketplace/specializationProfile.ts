export type SpecializationCategoryValue = {
  enabled?: boolean;
  skills?: unknown;
  groups?: unknown;
};

export type SpecializationCategoryMap = Record<string, SpecializationCategoryValue>;

const asCategoryMap = (value: unknown): SpecializationCategoryMap => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return Object.fromEntries(
    Object.entries(value).filter(([, category]) => (
      category !== null && typeof category === 'object' && !Array.isArray(category)
    )),
  ) as SpecializationCategoryMap;
};

const hasSelections = (value?: SpecializationCategoryValue) => {
  if (!value || value.enabled === false && !categorySkillCount(value)) return false;
  return value.enabled === true || categorySkillCount(value) > 0;
};

const categorySkillCount = (value?: SpecializationCategoryValue) => {
  if (!value) return 0;
  if (Array.isArray(value.skills)) return value.skills.filter((skill) => typeof skill === 'string' && skill.trim()).length;
  if (value.groups && typeof value.groups === 'object' && !Array.isArray(value.groups)) {
    return Object.values(value.groups).reduce((count, skills) => (
      count + (Array.isArray(skills) ? skills.filter((skill) => typeof skill === 'string' && skill.trim()).length : 0)
    ), 0);
  }
  return 0;
};

const mergeCategoryMaps = (primary: SpecializationCategoryMap, fallback: SpecializationCategoryMap) => {
  const merged: SpecializationCategoryMap = { ...fallback };
  Object.entries(primary).forEach(([key, value]) => {
    merged[key] = hasSelections(value) || !fallback[key] ? value : fallback[key];
  });
  return merged;
};

export const readSpecializationState = (specializations: unknown, legacy?: unknown) => {
  const root = specializations && typeof specializations === 'object' && !Array.isArray(specializations)
    ? specializations as Record<string, unknown>
    : {};
  const categories = asCategoryMap(root.categories);
  const approvedCategories = asCategoryMap(root.approvedCategories);
  const legacyCategories = asCategoryMap(legacy);
  const mergedCategories = Object.keys(categories).length
    ? mergeCategoryMaps(categories, legacyCategories)
    : legacyCategories;

  return {
    status: typeof root.approvalStatus === 'string' ? root.approvalStatus : undefined,
    categories: mergedCategories,
    approvedCategories,
  };
};

export const categorySkills = (value?: SpecializationCategoryValue): string[] => {
  if (!value) return [];
  if (Array.isArray(value.skills)) {
    return value.skills.filter((skill): skill is string => typeof skill === 'string');
  }
  if (value.groups && typeof value.groups === 'object' && !Array.isArray(value.groups)) {
    return [...new Set(Object.values(value.groups).flatMap((skills) => (
      Array.isArray(skills) ? skills.filter((skill): skill is string => typeof skill === 'string') : []
    )))];
  }
  return [];
};

export const categorySignature = (enabled: boolean, selections: string[]) => (
  JSON.stringify({ enabled, selections: [...selections].sort() })
);
