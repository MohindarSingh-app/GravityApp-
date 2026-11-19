import { useEffect, useRef, useState } from 'react';
import { Animated, Keyboard, KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StatusBar, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { FormNavigationProvider } from './forms/FormNavigation';

// Android may or may not resize the window for the keyboard, so pad only by the part it actually covers.
function useKeyboardState(rootRef) {
  const [state, setState] = useState({ open: false, inset: 0 });
  useEffect(() => {
    const ios = Platform.OS === 'ios';
    const show = Keyboard.addListener(ios ? 'keyboardWillShow' : 'keyboardDidShow', (event) => {
      if (ios) {
        setState({ open: true, inset: 0 });
        return;
      }
      const top = event.endCoordinates ? event.endCoordinates.screenY : 0;
      const node = rootRef.current;
      if (!node || !top) {
        setState({ open: true, inset: event.endCoordinates ? event.endCoordinates.height : 0 });
        return;
      }
      node.measureInWindow((_x, y, _width, height) => {
        setState({ open: true, inset: Math.max(0, Math.round(y + height - top)) });
      });
    });
    const hide = Keyboard.addListener(ios ? 'keyboardWillHide' : 'keyboardDidHide', () => {
      setState({ open: false, inset: 0 });
    });
    return () => {
      show.remove();
      hide.remove();
    };
  }, [rootRef]);
  return state;
}

export function Screen({
  children,
  scroll = true,
  header = null,
  headerScroll = false,
  overlayHeader = false,
  footer = null,
  footerFlush = false,
  footerTransparent = false,
  headerColor = null,
  statusBarStyle = null,
  refreshing = false,
  onRefresh,
  contentGap,
  scrollRef,
  stickyTop = null,
  stickyTopTransparent = false,
}) {
  const rootRef = useRef(null);
  const internalScrollRef = useRef(null);
  const formScrollOffsetRef = useRef(0);
  const headerTranslateY = useRef(new Animated.Value(0)).current;
  const lastScrollY = useRef(0);
  const scrollDirection = useRef(0);
  const directionDistance = useRef(0);
  const headerVisible = useRef(true);
  const [headerHeight, setHeaderHeight] = useState(0);
  const formScrollRef = scrollRef || internalScrollRef;
  const insets = useSafeAreaInsets();
  const keyboard = useKeyboardState(rootRef);
  const keyboardInset = keyboard.inset;
  const { colors, space, scheme } = useTheme();
  const bottom = keyboard.open ? space.sm : Math.max(insets.bottom, space.lg);
  const top = insets.top;
  const topFill = header ? (headerColor || colors.background) : colors.background;
  const barStyle = statusBarStyle || (scheme === 'dark' ? 'light-content' : 'dark-content');
  const autoHideHeader = Boolean(header && scroll && !overlayHeader);
  const stickyTopStyle = stickyTopTransparent
    ? {
        backgroundColor: colors.stickyGlass,
        borderBottomColor: colors.border,
        borderBottomWidth: StyleSheet.hairlineWidth,
      }
    : { backgroundColor: topFill, borderBottomColor: colors.border };
  const headerBackgroundStyle = overlayHeader
    ? { ...styles.headerOverlay, backgroundColor: topFill }
    : { backgroundColor: topFill };
  const headerContent = header ? (
    <View
      onLayout={autoHideHeader || overlayHeader ? (event) => {
        const nextHeight = event.nativeEvent.layout.height;
        setHeaderHeight((currentHeight) => (currentHeight === nextHeight ? currentHeight : nextHeight));
      } : undefined}
      style={[
        styles.headerSafeArea,
        headerBackgroundStyle,
        { paddingTop: insets.top },
      ]}
    >
      {header}
    </View>
  ) : null;
  const headerElement = autoHideHeader ? (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.autoHideHeader,
        { transform: [{ translateY: headerTranslateY }] },
      ]}
    >
      {headerContent}
    </Animated.View>
  ) : headerContent;

  const handleScroll = (event) => {
    const currentY = Math.max(0, event.nativeEvent.contentOffset.y);
    formScrollOffsetRef.current = currentY;
    if (!autoHideHeader) return;

    const movement = currentY - lastScrollY.current;
    let shouldShow = null;
    if (currentY === 0) {
      shouldShow = true;
      scrollDirection.current = 0;
      directionDistance.current = 0;
    } else if (movement !== 0) {
      const direction = Math.sign(movement);
      if (direction !== scrollDirection.current) {
        scrollDirection.current = direction;
        directionDistance.current = 0;
      }
      directionDistance.current += Math.abs(movement);
      if (directionDistance.current >= 4) {
        shouldShow = direction < 0;
        directionDistance.current = 0;
      }
    }

    lastScrollY.current = currentY;
    if (shouldShow === null || headerVisible.current === shouldShow) return;

    headerVisible.current = shouldShow;
    Animated.timing(headerTranslateY, {
      toValue: shouldShow ? 0 : -Math.max(headerHeight, 80),
      duration: 180,
      useNativeDriver: true,
    }).start();
  };

  const body = (
    <View style={[
      styles.inner,
      overlayHeader && header ? { paddingTop: headerHeight + 18 } : null,
      { paddingHorizontal: space.screen, paddingBottom: footer ? space.lg : bottom, gap: contentGap ?? space.md },
    ]}>
      {children}
    </View>
  );

  return (
    <View ref={rootRef} collapsable={false} style={[styles.root, { backgroundColor: colors.background }]}>
      {header ? (
        <StatusBar
          barStyle={barStyle}
          backgroundColor="transparent"
          translucent
        />
      ) : null}
      <KeyboardAvoidingView
        style={[styles.flex, keyboardInset ? { paddingBottom: keyboardInset } : null]}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={0}
      >
        <FormNavigationProvider
          scrollRef={scroll ? formScrollRef : null}
          scrollOffsetRef={scroll ? formScrollOffsetRef : null}
          bottomOffset={bottom + (footer ? 72 : 16)}
        >
        {header && (!headerScroll || !scroll || autoHideHeader) ? headerElement : null}
        {stickyTop && !scroll ? (
          <View style={[
            styles.stickyTop,
            stickyTopStyle,
          ]}>
            {stickyTop}
          </View>
        ) : null}
        {scroll ? (
          <ScrollView
            ref={formScrollRef}
            onScroll={handleScroll}
            scrollEventThrottle={16}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode="on-drag"
            contentContainerStyle={[
              styles.scroll,
              autoHideHeader ? { paddingTop: headerHeight } : { paddingTop: top },
            ]}
            stickyHeaderIndices={stickyTop ? [headerScroll && header && !autoHideHeader ? 1 : 0] : undefined}
            refreshControl={onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                tintColor={colors.accent}
                colors={[colors.accent]}
              />
            ) : undefined}
          >
            {headerScroll && scroll && !autoHideHeader ? headerElement : null}
            {stickyTop ? (
              <View style={[
                styles.stickyTop,
                stickyTopStyle,
              ]}>
                {stickyTop}
              </View>
            ) : null}
            {body}
          </ScrollView>
        ) : (
          <View style={[styles.flex, { paddingTop: top }]}>{body}</View>
        )}
        {footer ? (
          <View style={[
            styles.footer,
            {
              paddingHorizontal: footerFlush ? 0 : space.screen,
              paddingTop: footerFlush ? 0 : 12,
              paddingBottom: bottom,
              borderTopColor: colors.border,
              backgroundColor: footerTransparent ? 'transparent' : colors.surface,
              borderTopWidth: footerTransparent ? 0 : StyleSheet.hairlineWidth,
            },
          ]}
          >
            {footer}
          </View>
        ) : null}
        </FormNavigationProvider>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  flex: {
    flex: 1,
  },
  headerSafeArea: {
    zIndex: 1,
  },
  autoHideHeader: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 2,
    elevation: 2,
  },
  headerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'transparent',
  },
  scroll: {
    flexGrow: 1,
  },
  inner: {
    paddingTop: 18,
  },
  stickyTop: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  stickyTopTransparent: {
    backgroundColor: 'transparent',
    borderBottomColor: 'transparent',
    borderBottomWidth: 0,
  },
  footer: {
    borderTopWidth: 1,
  },
});
