import React, { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  Image,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { router } from 'expo-router';
import { useBulkUploadStore, CapturedCard } from '../src/store/bulkUploadStore';
import { GradeBadge } from '../src/components/GradeBadge';
import { listingsApi } from '../src/api/listings';
import { scheduleLocalNotification } from '../src/services/notifications';

const CONDITIONS = ['Mint', 'NM', 'LP', 'MP', 'HP', 'Damaged'];

function CardReviewItem({
  card,
  onUpdate,
}: {
  card: CapturedCard;
  onUpdate: (id: string, patch: Partial<CapturedCard>) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <View style={styles.cardItem}>
      <TouchableOpacity onPress={() => setExpanded((v) => !v)} activeOpacity={0.8}>
        <View style={styles.cardHeader}>
          <Image source={{ uri: card.localUri }} style={styles.thumbnail} resizeMode="cover" />
          <View style={styles.cardHeaderInfo}>
            <Text style={styles.cardName} numberOfLines={2}>
              {card.title || card.grade?.detectedName || 'Unknown Card'}
            </Text>
            {card.grade && (
              <GradeBadge grade={card.grade.grade} confidence={card.grade.confidence} />
            )}
            {card.price ? (
              <Text style={styles.pricePreview}>${card.price}</Text>
            ) : (
              <Text style={styles.priceHint}>Tap to set price</Text>
            )}
          </View>
          <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
        </View>
      </TouchableOpacity>

      {expanded && (
        <View style={styles.expandedForm}>
          <Text style={styles.label}>Title</Text>
          <TextInput
            style={styles.input}
            value={card.title ?? ''}
            onChangeText={(v) => onUpdate(card.id, { title: v })}
            placeholder="Card title"
            placeholderTextColor="#6b7280"
          />

          <Text style={styles.label}>Price (USD)</Text>
          <TextInput
            style={styles.input}
            value={card.price ?? ''}
            onChangeText={(v) => onUpdate(card.id, { price: v })}
            placeholder="e.g. 9.99"
            placeholderTextColor="#6b7280"
            keyboardType="decimal-pad"
          />

          <Text style={styles.label}>Condition</Text>
          <View style={styles.conditionRow}>
            {CONDITIONS.map((c) => (
              <TouchableOpacity
                key={c}
                style={[
                  styles.conditionChip,
                  card.condition === c && styles.conditionChipActive,
                ]}
                onPress={() => onUpdate(card.id, { condition: c })}
              >
                <Text
                  style={[
                    styles.conditionChipText,
                    card.condition === c && styles.conditionChipTextActive,
                  ]}
                >
                  {c}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Description (optional)</Text>
          <TextInput
            style={[styles.input, styles.inputMultiline]}
            value={card.description ?? ''}
            onChangeText={(v) => onUpdate(card.id, { description: v })}
            placeholder="Any additional details…"
            placeholderTextColor="#6b7280"
            multiline
            numberOfLines={3}
          />

          {card.grade && (
            <View style={styles.gradeDetail}>
              <Text style={styles.gradeDetailTitle}>AI Grading Result</Text>
              <Text style={styles.gradeDetailRow}>
                Grade: <Text style={{ color: '#f9fafb' }}>{card.grade.grade ?? 'N/A'}</Text>
              </Text>
              <Text style={styles.gradeDetailRow}>
                Confidence:{' '}
                <Text style={{ color: '#f9fafb' }}>
                  {Math.round((card.grade.confidence ?? 0) * 100)}%
                </Text>
              </Text>
              {card.grade.detectedName && (
                <Text style={styles.gradeDetailRow}>
                  Card: <Text style={{ color: '#f9fafb' }}>{card.grade.detectedName}</Text>
                </Text>
              )}
              {card.grade.detectedSet && (
                <Text style={styles.gradeDetailRow}>
                  Set: <Text style={{ color: '#f9fafb' }}>{card.grade.detectedSet}</Text>
                </Text>
              )}
            </View>
          )}
        </View>
      )}
    </View>
  );
}

export default function BulkReviewScreen() {
  const { cards, updateCard, clearAll } = useBulkUploadStore();
  const [submitting, setSubmitting] = useState(false);

  const reviewableCards = cards.filter((c) => c.status === 'ready' || c.status === 'error');

  const validate = (): string | null => {
    for (const card of reviewableCards) {
      if (!card.title) return `Please add a title for all cards.`;
      if (!card.price || isNaN(parseFloat(card.price))) return `Please set a valid price for all cards.`;
      if (!card.condition) return `Please set a condition for all cards.`;
    }
    return null;
  };

  const handleSubmit = async () => {
    const err = validate();
    if (err) {
      Alert.alert('Missing info', err);
      return;
    }

    setSubmitting(true);
    try {
      const items = reviewableCards.map((card) => ({
        photo_id: card.photoId!,
        title: card.title!,
        price: card.price!,
        condition: card.condition!,
        description: card.description ?? '',
      }));

      await listingsApi.bulkCreate(items);

      await scheduleLocalNotification(
        '🎉 Cards Listed!',
        `${items.length} card${items.length !== 1 ? 's' : ''} are now live on the marketplace.`,
        'sales',
      );

      clearAll();
      Alert.alert(
        'Listed!',
        `${items.length} card${items.length !== 1 ? 's' : ''} are now live.`,
        [{ text: 'View Market', onPress: () => router.replace('/(tabs)') }],
      );
    } catch (e) {
      Alert.alert('Error', 'Failed to list cards. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (reviewableCards.length === 0) {
    return (
      <View style={styles.centered}>
        <Text style={{ color: '#9ca3af' }}>No cards to review.</Text>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <FlatList
        data={reviewableCards}
        keyExtractor={(c) => c.id}
        renderItem={({ item }) => (
          <CardReviewItem card={item} onUpdate={updateCard} />
        )}
        contentContainerStyle={styles.list}
        ListHeaderComponent={
          <Text style={styles.header}>
            Review {reviewableCards.length} Card{reviewableCards.length !== 1 ? 's' : ''}
          </Text>
        }
      />

      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.submitBtn, submitting && styles.submitBtnDisabled]}
          onPress={handleSubmit}
          disabled={submitting}
        >
          {submitting ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.submitBtnText}>
              List {reviewableCards.length} Card{reviewableCards.length !== 1 ? 's' : ''} for Sale
            </Text>
          )}
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0f0f1a' },
  list: { padding: 12, paddingBottom: 100, gap: 8 },
  header: {
    color: '#f9fafb',
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 8,
  },
  cardItem: {
    backgroundColor: '#1f2937',
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#374151',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    gap: 12,
  },
  thumbnail: { width: 56, height: 78, borderRadius: 6 },
  cardHeaderInfo: { flex: 1, gap: 4 },
  cardName: { color: '#f9fafb', fontWeight: '600', fontSize: 14 },
  pricePreview: { color: '#10b981', fontWeight: '700', fontSize: 15 },
  priceHint: { color: '#6b7280', fontSize: 13 },
  chevron: { color: '#6b7280', fontSize: 12 },
  expandedForm: {
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: '#374151',
    gap: 6,
  },
  label: { color: '#9ca3af', fontSize: 12, fontWeight: '600', marginTop: 4 },
  input: {
    backgroundColor: '#111827',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: '#f9fafb',
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#374151',
  },
  inputMultiline: { minHeight: 72, textAlignVertical: 'top' },
  conditionRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  conditionChip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
    backgroundColor: '#111827',
    borderWidth: 1,
    borderColor: '#374151',
  },
  conditionChipActive: { backgroundColor: '#4f46e5', borderColor: '#4f46e5' },
  conditionChipText: { color: '#9ca3af', fontSize: 12 },
  conditionChipTextActive: { color: '#fff', fontWeight: '700' },
  gradeDetail: {
    backgroundColor: '#111827',
    borderRadius: 8,
    padding: 10,
    marginTop: 8,
    gap: 3,
  },
  gradeDetailTitle: { color: '#6b7280', fontSize: 11, fontWeight: '700', marginBottom: 4 },
  gradeDetailRow: { color: '#6b7280', fontSize: 12 },
  footer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: 'rgba(15,15,26,0.95)',
    borderTopWidth: 1,
    borderTopColor: '#374151',
  },
  submitBtn: {
    backgroundColor: '#4f46e5',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  submitBtnDisabled: { opacity: 0.6 },
  submitBtnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#0f0f1a' },
});
