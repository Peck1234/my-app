import { StyleSheet, View, useWindowDimensions } from 'react-native'

const MAX_CONTENT_WIDTH = 640
const WIDE_BREAKPOINT = 700

export default function ResponsiveContainer({ children, style }) {
  const { width } = useWindowDimensions()
  const isWide = width >= WIDE_BREAKPOINT
  const horizontalPadding = width < 380 ? 16 : isWide ? 32 : 20

  return (
    <View style={styles.outer}>
      <View
        style={[
          styles.inner,
          { paddingHorizontal: horizontalPadding },
          isWide && styles.wide,
          style,
        ]}
      >
        {children}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  outer: {
    flex: 1,
    alignItems: 'center',
    width: '100%',
  },
  inner: {
    flex: 1,
    width: '100%',
  },
  wide: {
    maxWidth: MAX_CONTENT_WIDTH,
  },
})
