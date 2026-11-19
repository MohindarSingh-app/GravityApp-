import React, { useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppButton } from '../../components/AppButton';
import { AppHeader, goBackOrHome } from '../../components/AppHeader';
import { AppTextInput } from '../../components/AppTextInput';
import { registerThemeStyles, theme } from '../../components/theme';
import { useUserPreferences } from '../../providers/UserPreferencesProvider';
import { apiService } from '../../services/api';
import { launchImageLibraryAsync } from '../../services/imagePicker';

export interface SupplierProduct {
  id: number;
  name: string;
  category?: string;
  brand?: string;
  description?: string;
  price?: number;
  stock?: number;
  sku?: string;
  imageRef?: string;
  status?: string;
}

interface ProductForm {
  name: string;
  category: string;
  brand: string;
  description: string;
  price: string;
  stock: string;
  sku: string;
  status: string;
  imageRef: string;
}

interface SupplierProductFormScreenProps {
  route: { params?: { product?: SupplierProduct } };
  navigation: any;
}

const CATEGORIES = [
  'Switchgear',
  'Cables & Wires',
  'VFD / Drives',
  'PLC / Automation',
  'Panel Components',
  'Tools & Safety Gear',
  'Lighting',
];
const STATUSES = [
  { key: 'active', label: 'Active' },
  { key: 'out_of_stock', label: 'Out of stock' },
  { key: 'delisted', label: 'Delisted' },
];

const blankProduct: ProductForm = {
  name: '',
  category: CATEGORIES[0],
  brand: '',
  description: '',
  price: '0',
  stock: '0',
  sku: '',
  status: 'active',
  imageRef: '',
};

const formFromProduct = (product?: SupplierProduct): ProductForm => product
  ? {
    name: product.name || '',
    category: product.category || CATEGORIES[0],
    brand: product.brand || '',
    description: product.description || '',
    price: String(product.price ?? 0),
    stock: String(product.stock ?? 0),
    sku: product.sku || '',
    status: product.status || 'active',
    imageRef: product.imageRef || '',
  }
  : { ...blankProduct };

export const SupplierProductFormScreen: React.FC<SupplierProductFormScreenProps> = ({ route, navigation }) => {
  const { colors } = useUserPreferences();
  const product = route.params?.product;
  const [form, setForm] = useState<ProductForm>(() => formFromProduct(product));
  const [working, setWorking] = useState(false);
  const [error, setError] = useState('');
  const setField = (key: keyof ProductForm, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const chooseImage = async () => {
    setError('');
    try {
      const result = await launchImageLibraryAsync({ quality: 0.8 });
      if (!result.canceled && result.assets[0]) setField('imageRef', result.assets[0].uri);
    } catch (pickerError: any) {
      setError(pickerError.message || 'Could not open the photo library.');
    }
  };

  const saveProduct = async () => {
    const price = Number(form.price);
    const stock = Number(form.stock);
    if (!form.name.trim()) {
      setError('Enter a product name.');
      return;
    }
    if (!Number.isFinite(price) || price < 0 || !Number.isFinite(stock) || stock < 0) {
      setError('Enter a valid non-negative price and stock quantity.');
      return;
    }
    setWorking(true);
    setError('');
    try {
      const payload = {
        ...form,
        price,
        stock: Math.floor(stock),
      };
      if (product) await apiService.updateProduct(product.id, payload);
      else await apiService.createProduct(payload);
      navigation.goBack();
    } catch (saveError: any) {
      setError(saveError.response?.data?.message || 'Could not save the product.');
    } finally {
      setWorking(false);
    }
  };

  const deleteProduct = async () => {
    if (!product) return;
    setWorking(true);
    setError('');
    try {
      await apiService.deleteProduct(product.id);
      navigation.goBack();
    } catch (deleteError: any) {
      setError(deleteError.response?.data?.message || 'Could not remove the product.');
    } finally {
      setWorking(false);
    }
  };

  return (
    <SafeAreaView edges={['bottom']} style={[styles.screen, { backgroundColor: colors.background }]}>
      <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <AppHeader
        title={product ? 'Edit product' : 'Add product'}
        subtitle="Manage supplier listing details"
        onBack={() => goBackOrHome(navigation)}
      />
      <ScrollView contentContainerStyle={styles.form} keyboardShouldPersistTaps="handled" keyboardDismissMode="on-drag">
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Product images</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={form.imageRef ? 'Change product image' : 'Add product image'}
          style={[styles.imagePicker, { backgroundColor: colors.surface, borderColor: colors.border }]}
          onPress={() => { void chooseImage(); }}
        >
          {form.imageRef ? (
            <Image source={{ uri: form.imageRef }} style={styles.productImage} />
          ) : (
            <Text style={[styles.imagePlus, { color: colors.primary }]}>+</Text>
          )}
          <Text style={[styles.imagePickerTitle, { color: colors.primary }]}>
            {form.imageRef ? 'Image selected' : 'Add product image'}
          </Text>
          <Text style={[styles.helper, { color: colors.secondaryText }]}>
            Image uploads are not available until cloud storage is configured.
          </Text>
        </Pressable>

        <AppTextInput label="Product name" value={form.name} onChangeText={(value) => setField('name', value)} placeholder="MCB 32A Single Pole" />
        <Text style={[styles.fieldLabel, { color: colors.text }]}>Category</Text>
        <View style={styles.optionGrid}>
          {CATEGORIES.map((category) => (
            <Choice key={category} label={category} selected={form.category === category} onPress={() => setField('category', category)} />
          ))}
        </View>
        <AppTextInput label="Brand" value={form.brand} onChangeText={(value) => setField('brand', value)} placeholder="ABB, Siemens, L&T" />
        <AppTextInput label="SKU" value={form.sku} onChangeText={(value) => setField('sku', value)} placeholder="Product code" autoCapitalize="characters" />
        <AppTextInput label="Description" value={form.description} onChangeText={(value) => setField('description', value)} placeholder="Specs, ratings, compliance standard..." multiline />
        <View style={styles.numbers}>
          <View style={styles.numberField}><AppTextInput label="Price (₹)" value={form.price} onChangeText={(value) => setField('price', value)} keyboardType="decimal-pad" /></View>
          <View style={styles.numberField}><AppTextInput label="Stock quantity" value={form.stock} onChangeText={(value) => setField('stock', value)} keyboardType="number-pad" /></View>
        </View>
        <Text style={[styles.fieldLabel, { color: colors.text }]}>Status</Text>
        <View style={styles.optionGrid}>
          {STATUSES.map((status) => (
            <Choice key={status.key} label={status.label} selected={form.status === status.key} onPress={() => setField('status', status.key)} />
          ))}
        </View>
        {error ? <Text accessibilityRole="alert" style={styles.error}>{error}</Text> : null}
        <AppButton title={product ? 'Save changes' : 'Save product'} onPress={saveProduct} loading={working} style={styles.saveButton} />
        {product ? <AppButton title="Remove product" onPress={deleteProduct} loading={working} variant="outline" /> : null}
        <Pressable onPress={() => goBackOrHome(navigation)} style={styles.cancel}>
          <Text style={[styles.cancelText, { color: colors.secondaryText }]}>Cancel</Text>
        </Pressable>
      </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
};

const Choice = ({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) => (
  <Pressable
    accessibilityRole="button"
    accessibilityState={{ selected }}
    onPress={onPress}
    style={[styles.choice, selected && styles.choiceSelected]}
  >
    <Text style={[styles.choiceText, selected && styles.choiceTextSelected]}>{label}</Text>
  </Pressable>
);

const build_styles = () => StyleSheet.create({
  screen: { flex: 1, backgroundColor: theme.colors.primaryBackground },
  form: { paddingHorizontal: theme.spacing.lg, paddingBottom: 112 },
  sectionTitle: { fontSize: 15, fontWeight: '700', marginBottom: 10 },
  imagePicker: { borderWidth: 1, borderStyle: 'dashed', borderRadius: theme.borderRadius.md, padding: 14, marginBottom: 18, alignItems: 'center' },
  imagePlus: { fontSize: 30, lineHeight: 34, fontWeight: '400' },
  productImage: { width: 76, height: 76, borderRadius: theme.borderRadius.sm, marginBottom: 6 },
  imagePickerTitle: { fontSize: 13, fontWeight: '700' },
  helper: { fontSize: 11, marginTop: 4, textAlign: 'center' },
  fieldLabel: { fontSize: 13, fontWeight: '700', marginBottom: 8 },
  optionGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 17 },
  choice: { borderWidth: 1, borderColor: theme.colors.borderStrong, borderRadius: theme.borderRadius.sm, paddingHorizontal: 9, paddingVertical: 7 },
  choiceSelected: { backgroundColor: theme.colors.softBrand, borderColor: theme.colors.primary },
  choiceText: { color: theme.colors.secondaryText, fontSize: 11 },
  choiceTextSelected: { color: theme.colors.brandInk, fontWeight: '700' },
  numbers: { flexDirection: 'row', gap: 12 },
  numberField: { flex: 1 },
  error: { color: theme.colors.error, marginVertical: 10, fontSize: 13 },
  saveButton: { marginTop: 6 },
  cancel: { padding: 14, alignItems: 'center' },
  cancelText: { fontWeight: '600' },
});
let styles = build_styles();
registerThemeStyles(() => { styles = build_styles(); });
