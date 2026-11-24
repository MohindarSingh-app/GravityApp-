import {
  Animated, Pressable, StyleSheet, Text, View,
} from 'react-native';
import {
  createContext, useCallback, useContext, useEffect, useMemo, useRef, useState,
} from 'react';
import { useTheme } from '../../theme/ThemeContext';

const FormNavigationContext = createContext(null);

function orderedFields(fields) {
  return [...fields.entries()].sort((a, b) => {
    const firstY = a[1].position;
    const secondY = b[1].position;
    if (Number.isFinite(firstY) && Number.isFinite(secondY) && firstY !== secondY) {
      return firstY - secondY;
    }
    return a[1].order - b[1].order;
  });
}

function FormNavigationPrompt({ visible, onAdvance, bottomOffset }) {
  const { colors, radius, type } = useTheme();
  const pulse = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    if (!visible) {
      pulse.setValue(0.55);
      return undefined;
    }
    const animation = Animated.loop(Animated.sequence([
      Animated.timing(pulse, {
        toValue: 1,
        duration: 450,
        useNativeDriver: true,
      }),
      Animated.timing(pulse, {
        toValue: 0.55,
        duration: 450,
        useNativeDriver: true,
      }),
    ]));
    animation.start();
    return () => animation.stop();
  }, [pulse, visible]);

  if (!visible) return null;

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.promptPosition,
        { bottom: bottomOffset, opacity: pulse },
      ]}
    >
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Go to next field"
        accessibilityHint="Scroll to and focus the next form field"
        onPress={onAdvance}
        style={({ pressed }) => [
          styles.promptButton,
          {
            backgroundColor: colors.primary,
            borderRadius: radius.pill,
            shadowColor: colors.text,
          },
          pressed && styles.promptPressed,
        ]}
      >
        <Text style={[type.label, styles.promptText, { color: colors.onAccent }]}>
          Next field ↓
        </Text>
      </Pressable>
    </Animated.View>
  );
}

export function FormNavigationProvider({
  children,
  scrollRef = null,
  scrollOffsetRef = null,
  bottomOffset = 16,
}) {
  const fields = useRef(new Map());
  const nextOrder = useRef(0);
  const pendingAdvance = useRef(null);
  const [revision, setRevision] = useState(0);
  const [activeId, setActiveId] = useState(null);

  const measurePositions = useCallback((onComplete) => {
    const scroll = scrollRef && scrollRef.current;
    if (!scroll) {
      if (onComplete) onComplete();
      return;
    }

    const measurable = [...fields.current.entries()].filter(([, field]) => (
      field.fieldRef && field.fieldRef.current
      && typeof field.fieldRef.current.measureLayout === 'function'
    ));
    if (!measurable.length) {
      if (onComplete) onComplete();
      return;
    }

    let remaining = measurable.length;
    const finish = () => {
      remaining -= 1;
      if (remaining === 0 && onComplete) onComplete();
    };
    measurable.forEach(([id, field]) => {
      field.fieldRef.current.measureLayout(
        scroll,
        (_x, y) => {
          const current = fields.current.get(id);
          const position = y + (scrollOffsetRef ? scrollOffsetRef.current : 0);
          if (current && (!Number.isFinite(current.position) || Math.abs(current.position - position) > 1)) {
            fields.current.set(id, { ...current, position });
            setRevision((value) => value + 1);
          }
          finish();
        },
        finish,
      );
    });
  }, [scrollOffsetRef, scrollRef]);

  const register = useCallback((id, focus, fieldRef, enabled) => {
    const previous = fields.current.get(id);
    fields.current.set(id, {
      focus,
      fieldRef,
      enabled,
      position: previous ? previous.position : null,
      order: previous ? previous.order : nextOrder.current++,
    });
    if (!previous || previous.enabled !== enabled) setRevision((current) => current + 1);
    measurePositions();

    return () => {
      if (fields.current.get(id)?.focus === focus) {
        fields.current.delete(id);
        setActiveId((current) => (current === id ? null : current));
        setRevision((current) => current + 1);
        measurePositions();
      }
    };
  }, [measurePositions]);

  const hasNext = useCallback((id) => {
    const ordered = orderedFields(fields.current).filter(([, field]) => field.enabled);
    const index = ordered.findIndex(([fieldId]) => fieldId === id);
    return index >= 0 && index < ordered.length - 1;
  }, []);

  const scrollToField = useCallback((id) => {
    const target = fields.current.get(id)?.fieldRef?.current;
    const scroll = scrollRef && scrollRef.current;
    if (!target || !scroll || typeof target.measureLayout !== 'function') return;

    target.measureLayout(
      scroll,
      (_x, y) => {
        if (scroll && typeof scroll.scrollTo === 'function') {
          const offset = scrollOffsetRef ? scrollOffsetRef.current : 0;
          scroll.scrollTo({ y: Math.max(0, y + offset - 24), animated: true });
        }
      },
      () => {},
    );
  }, [scrollOffsetRef, scrollRef]);

  const activate = useCallback((id, showPrompt = false) => {
    setActiveId(showPrompt && fields.current.get(id)?.enabled ? id : null);
    scrollToField(id);
  }, [scrollToField]);

  const advance = useCallback((id) => {
    if (pendingAdvance.current) clearTimeout(pendingAdvance.current);
    setActiveId(null);
    if (!hasNext(id)) return false;

    pendingAdvance.current = setTimeout(() => {
      pendingAdvance.current = null;
      measurePositions(() => {
        const ordered = orderedFields(fields.current).filter(([, field]) => field.enabled);
        const index = ordered.findIndex(([fieldId]) => fieldId === id);
        const next = ordered[index + 1];
        if (!next) return;
        scrollToField(next[0]);
        next[1].focus();
      });
    }, 180);
    return true;
  }, [hasNext, measurePositions, scrollToField]);

  const advanceActive = useCallback(() => (
    activeId == null ? false : advance(activeId)
  ), [activeId, advance]);

  useEffect(() => () => {
    if (pendingAdvance.current) clearTimeout(pendingAdvance.current);
  }, []);

  const value = useMemo(() => ({
    register,
    activate,
    advance,
    advanceActive,
    hasNext,
    activeId,
    revision,
  }), [activeId, activate, advance, advanceActive, hasNext, register, revision]);
  const promptVisible = activeId != null && hasNext(activeId);

  return (
    <FormNavigationContext.Provider value={value}>
      <View style={styles.provider}>
        {children}
        {promptVisible ? (
          <FormNavigationPrompt
            visible
            onAdvance={advanceActive}
            bottomOffset={bottomOffset}
          />
        ) : null}
      </View>
    </FormNavigationContext.Provider>
  );
}

export function useFormNavigationField(focus, enabled = true, fieldRef = null) {
  const context = useContext(FormNavigationContext);
  const id = useRef({}).current;
  const register = context ? context.register : null;
  const activateField = context ? context.activate : null;
  const advanceField = context ? context.advance : null;
  const hasNextField = context ? context.hasNext : null;

  useEffect(() => {
    if (!register) return undefined;
    return register(id, focus, fieldRef, enabled);
  }, [enabled, fieldRef, focus, id, register]);

  const activate = useCallback(
    (showPrompt = false) => (activateField ? activateField(id, showPrompt) : false),
    [activateField, id],
  );
  const advance = useCallback(
    () => (advanceField ? advanceField(id) : false),
    [advanceField, id],
  );

  return {
    activate,
    advance,
    hasNext: Boolean(hasNextField && hasNextField(id)),
    enabled: Boolean(context && enabled),
    revision: context ? context.revision : 0,
  };
}

const styles = StyleSheet.create({
  provider: {
    flex: 1,
  },
  promptPosition: {
    position: 'absolute',
    right: 14,
    alignItems: 'flex-end',
    zIndex: 100,
    elevation: 10,
  },
  promptButton: {
    minHeight: 36,
    paddingHorizontal: 12,
    justifyContent: 'center',
    alignItems: 'center',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.24,
    shadowRadius: 8,
    elevation: 6,
  },
  promptText: {
    fontSize: 11,
    fontWeight: '700',
  },
  promptPressed: {
    transform: [{ scale: 0.97 }],
  },
});
