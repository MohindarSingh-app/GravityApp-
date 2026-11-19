import React, { useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import { registerThemeStyles, theme } from './theme';

interface Point {
  x: number;
  y: number;
}

/**
 * Signature capture pad (GAP-03).
 * Matches the HTML reference behaviour: a dashed signature box that becomes
 * "signed" once the customer/partner draws inside it. Strokes are captured
 * with a PanResponder and rendered as touch points; the collected point
 * count acts as the signature payload.
 */
export const SignaturePad: React.FC<{
  onChange?: (signed: boolean) => void;
}> = ({ onChange }) => {
  const [strokes, setStrokes] = useState<Point[][]>([]);
  const [size, setSize] = useState({ width: 0, height: 0 });
  const currentStroke = useRef<Point[]>([]);

  const panResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (event) => {
      currentStroke.current = [{
        x: event.nativeEvent.locationX,
        y: event.nativeEvent.locationY,
      }];
    },
    onPanResponderMove: (event) => {
      currentStroke.current.push({
        x: event.nativeEvent.locationX,
        y: event.nativeEvent.locationY,
      });
      setStrokes((prev) => {
        const next = prev.slice(0, -1).concat([currentStroke.current.slice()]);
        return next;
      });
    },
    onPanResponderRelease: () => {
      if (currentStroke.current.length > 0) {
        setStrokes((prev) => {
          const next = prev.slice(0, -1).concat([currentStroke.current.slice()]);
          if (next.flat().length > 0) onChange?.(true);
          return next;
        });
      }
      currentStroke.current = [];
    },
  }), [onChange]);

  const signed = strokes.flat().length > 0;
  const dotSize = 2;

  const clear = () => {
    setStrokes([]);
    onChange?.(false);
  };

  return (
    <View>
      <View
        accessibilityLabel="Signature pad"
        {...panResponder.panHandlers}
        onLayout={(event) => setSize({
          width: event.nativeEvent.layout.width,
          height: event.nativeEvent.layout.height,
        })}
        style={[
          styles.pad,
          signed ? styles.padSigned : styles.padUnsigned,
          { backgroundColor: theme.colors.surfaceVariant },
        ]}
      >
        {size.width > 0 && strokes.map((stroke, strokeIndex) =>
          stroke.map((point, pointIndex) => (
            <View
              key={`${strokeIndex}-${pointIndex}`}
              style={{
                position: 'absolute',
                left: point.x - dotSize / 2,
                top: point.y - dotSize / 2,
                width: dotSize,
                height: dotSize,
                borderRadius: dotSize / 2,
                backgroundColor: theme.colors.brandInk,
              }}
            />
          )),
        )}
        {!signed ? (
          <Text style={styles.placeholder}>Sign here to confirm completion</Text>
        ) : null}
      </View>
      {signed ? (
        <Text style={styles.signedLabel} onPress={clear}>Signed — tap to clear</Text>
      ) : null}
    </View>
  );
};

const build_styles = () => StyleSheet.create({
  pad: {
    height: 120,
    borderRadius: theme.borderRadius.md,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  padUnsigned: {
    borderStyle: 'dashed',
    borderColor: theme.colors.borderStrong,
  },
  padSigned: {
    borderStyle: 'solid',
    borderColor: theme.colors.success,
  },
  placeholder: {
    color: theme.colors.secondaryText,
    fontSize: 12,
  },
  signedLabel: {
    color: theme.colors.success,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 6,
    alignSelf: 'flex-end',
  },
});

let styles = build_styles();
registerThemeStyles(() => { styles = build_styles(); });
