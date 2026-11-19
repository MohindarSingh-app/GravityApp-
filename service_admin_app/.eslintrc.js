module.exports = {
  root: true,
  extends: '@react-native',
  rules: {
    // Theme colors are dynamic (light/dark) so inline styles carrying
    // colors.text / colors.primary etc. are intentional across the app.
    'react-native/no-inline-styles': 'off',
  },
};
