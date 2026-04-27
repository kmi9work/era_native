import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useMarketScreenLogic } from './hooks/useMarketScreenLogic';
import ResourceItem from './ResourceItem';
import ScannerStatusBadge from '../components/ScannerStatusBadge';

// Navigation prop приходит автоматически от React Navigation
const MarketScreen = () => {
  const navigation = useNavigation();
  const logic = useMarketScreenLogic();

  const {
    marketGuilds,
    selectedMarketGuild,
    countries,
    selectedCountry,
    marketResources,
    resourcesPlSells,
    resourcesPlBuys,
    showMarketForm,
    viaVyatka,
    isCarProtected,
    guildRobberyProbabilities,
    resToPlayer,
    totalPurchaseCost,
    totalSaleIncome,
    caravanPending,
    newRelations,
    contrabandConfirmed,
    loading,
    isGameArtel,
    isEmbargoActiveForSelected,
    handleSelectGuildForMarket,
    handleBackToGuildSelection,
    handleCalculateCaravan,
    handleShowConfirmDialog,
    handleResetMarketForm,
    handleLoadMarketData,
    setViaVyatka,
    setIsCarProtected,
    setContrabandConfirmed,
    setSelectedCountry,
    setResourcesPlSells,
    setResourcesPlBuys,
    updateResourcesArrays,
    getRobberyProbability,
    hasEmbargo,
    getResourceImageUrl,
    getCountryFlagUrl,
  } = logic;

  // Обёртки для делегирования
  const handleSelectGuildForMarketWrapper = (guildId: number) => {
    handleSelectGuildForMarket(guildId);
  };

  const handleBackToGuildSelectionWrapper = () => {
    handleBackToGuildSelection();
  };

  const handleCalculateCaravanWrapper = () => {
    handleCalculateCaravan();
  };

  const handleShowConfirmDialogWrapper = () => {
    handleShowConfirmDialog();
  };

  const handleResetMarketFormWrapper = () => {
    handleResetMarketForm();
  };

  const handleRefreshPrices = async () => {
    try {
      await handleLoadMarketData();
      if (isGameArtel) {
        updateResourcesArrays(null);
      } else if (selectedCountry != null) {
        updateResourcesArrays(selectedCountry);
      }
      // newRelations будет установлен внутри handleLoadMarketData
    } catch (error: any) {
      // ignore
    }
  };

  // Выбор гильдии
  if (!showMarketForm) {
    return (
      <View style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.headerBackButton} activeOpacity={0.7} onPress={() => navigation.goBack()}>
            <Text style={styles.headerBackButtonText}>Назад</Text>
          </TouchableOpacity>
          <Text style={styles.title}>Рынок</Text>
          <View style={styles.headerRight}>
            <ScannerStatusBadge style={styles.headerBadge} />
          </View>
        </View>

        {loading && !showMarketForm && marketGuilds.length === 0 ? (
          <View style={styles.content}>
            <ActivityIndicator size="large" color="#1976d2" />
          </View>
        ) : (
          <ScrollView style={styles.content}>
            <Text style={styles.stepTitle}>Новый караван</Text>
            <Text style={styles.stepSubtitle}>Выберите гильдию для каравана:</Text>

            {!isGameArtel && (
              <View style={styles.marketCheckboxesContainer}>
                <View style={styles.marketCheckboxRow}>
                  <TouchableOpacity
                    style={[styles.checkbox, viaVyatka && styles.checkboxChecked]}
                    onPress={() => setViaVyatka(!viaVyatka)}
                  >
                    {viaVyatka && <Text style={styles.checkboxText}>✓</Text>}
                  </TouchableOpacity>
                  <Text style={styles.checkboxLabel}>Караван идёт через Вятку</Text>
                </View>
                {viaVyatka && (
                  <Text style={styles.checkboxHint}>
                    Караван не может быть ограблен. Отправка каравана не изменяет товарооборот.
                  </Text>
                )}

                <View style={styles.marketCheckboxRow}>
                  <TouchableOpacity
                    style={[styles.checkbox, isCarProtected && styles.checkboxChecked]}
                    onPress={() => setIsCarProtected(!isCarProtected)}
                  >
                    {isCarProtected && <Text style={styles.checkboxText}>✓</Text>}
                  </TouchableOpacity>
                  <Text style={styles.checkboxLabel}>Караван идёт под охраной</Text>
                </View>
              </View>
            )}

            <View style={styles.guildsListContainer}>
              {marketGuilds.map((guild) => (
                <View key={guild.id} style={styles.guildItemContainer}>
                  <TouchableOpacity
                    style={styles.itemButton}
                    activeOpacity={0.7}
                    onPress={() => handleSelectGuildForMarketWrapper(guild.id)}
                  >
                    <View style={styles.itemButtonContent}>
                      <Text style={styles.itemButtonText}>{guild.name}</Text>
                      {!isGameArtel && (
                        <Text
                          style={[
                            styles.guildRiskText,
                            guildRobberyProbabilities[guild.id]?.probability > 0
                              ? styles.guildRiskTextWarning
                              : styles.guildRiskTextSafe
                          ]}
                        >
                          Риск: {getRobberyProbability(guild.id)}
                        </Text>
                      )}
                    </View>
                    <Text style={styles.itemButtonArrow}>›</Text>
                  </TouchableOpacity>
                </View>
              ))}
            </View>
          </ScrollView>
        )}
      </View>
    );
  }

  // Форма рынка
  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBackButton} activeOpacity={0.7} onPress={handleBackToGuildSelectionWrapper}>
          <Text style={styles.headerBackButtonText}>Назад</Text>
        </TouchableOpacity>
        <Text style={styles.title}>Рынок</Text>
        <View style={styles.headerRight}>
          <ScannerStatusBadge style={styles.headerBadge} />
        </View>
      </View>

      <ScrollView 
        style={styles.content}
        contentContainerStyle={styles.scrollViewContent}
      >
        {/* Выбор страны (скрыт для Artel / рынок без страны) */}
        {!isGameArtel && (
          <View style={styles.countryButtonsContainer}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              {countries.map((country) => (
                <TouchableOpacity
                  key={country.id}
                  style={[
                    styles.countryButton,
                    selectedCountry === country.id && styles.countryButtonSelected,
                    hasEmbargo(country) && styles.countryButtonEmbargo
                  ]}
                  onPress={() => {
                    setSelectedCountry(country.id);
                    updateResourcesArrays(country.id);
                  }}
                >
                  <Image
                    source={{ uri: getCountryFlagUrl(country) || `${logic.getImagesBaseUrl()}/images/countries/unknown.png` }}
                    style={styles.countryFlag}
                    resizeMode="contain"
                    onError={(e) => {
                      console.log('Error loading country flag:', {
                        country: country.name,
                        flag_image_name: country.flag_image_name,
                        url: getCountryFlagUrl(country),
                        error: e.nativeEvent?.error
                      });
                    }}
                    onLoad={() => {
                      console.log('Country flag loaded successfully:', {
                        country: country.name,
                        flag_image_name: country.flag_image_name,
                        url: getCountryFlagUrl(country)
                      });
                    }}
                  />
                  <Text style={styles.countryButtonText}>
                    {country.short_name || country.name}
                  </Text>
                  {hasEmbargo(country) && (
                    <Text style={styles.embargoLabel}>Эмбарго</Text>
                  )}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        )}

        {/* Форма "Игрок продает" */}
        <View style={styles.marketFormSection}>
          <Text style={styles.marketFormTitle}>
            {isGameArtel ? 'Игрок продаёт' : 'Игрок отправляет с караваном' + (viaVyatka ? ' (через Вятку)' : '')} 
          </Text>
          <View style={styles.resourcesInputContainer}>
            {resourcesPlSells.map((item, index) => {
              const resource = marketResources.to_market.find(
                r => r.identificator === item.identificator &&
                     (isGameArtel ? (r.country_id == null && r.country?.id == null) : (r.country_id === selectedCountry || r.country?.id === selectedCountry))
              );
              return (
                <View key={index} style={styles.resourceInputRow}>
                  <Image
                    source={{ uri: getResourceImageUrl(item.identificator) }}
                    style={styles.resourceIcon}
                  />
                  <TextInput
                    style={styles.resourceInput}
                    value={item.count?.toString() || ''}
                    onChangeText={(text) => {
                      // Удаляем все символы, кроме цифр
                      const cleanedText = text.replace(/[^0-9]/g, '');
                      setResourcesPlSells(prev => {
                        const newSells = [...prev];
                        newSells[index] = { ...newSells[index], count: cleanedText ? Number(cleanedText) : null };
                        return newSells;
                      });
                    }}
                    placeholder={`${item.name || ''} ${resource?.sell_price ? `по ${resource.sell_price}` : 'Золото'}`}
                    keyboardType="numeric"
                  />
                </View>
              );
            })}
          </View>
        </View>

        {/* Форма "Игрок заказал" */}
        <View style={styles.marketFormSection}>
          <Text style={styles.marketFormTitle}>
            {isGameArtel ? 'Игрок покупает' : 'Игрок заказал' + (viaVyatka ? ' (через Вятку)' : '')} 
          </Text>
          <View style={styles.resourcesInputContainer}>
            {resourcesPlBuys.map((item, index) => {
              const resource = marketResources.off_market.find(
                r => r.identificator === item.identificator &&
                     (isGameArtel ? (r.country_id == null && r.country?.id == null) : (r.country_id === selectedCountry || r.country?.id === selectedCountry))
              );
              return (
                <View key={index} style={styles.resourceInputRow}>
                  <Image
                    source={{ uri: getResourceImageUrl(item.identificator) }}
                    style={styles.resourceIcon}
                  />
                  <TextInput
                    style={styles.resourceInput}
                    value={item.count?.toString() || ''}
                    onChangeText={(text) => {
                      // Удаляем все символы, кроме цифр
                      const cleanedText = text.replace(/[^0-9]/g, '');
                      setResourcesPlBuys(prev => {
                        const newBuys = [...prev];
                        newBuys[index] = { ...newBuys[index], count: cleanedText ? Number(cleanedText) : null };
                        return newBuys;
                      });
                    }}
                    placeholder={`${item.name || ''} ${resource?.buy_price ? `по ${resource.buy_price}` : ''}`}
                    keyboardType="numeric"
                  />
                </View>
              );
            })}
          </View>
        </View>

        {/* Кнопки действий */}
        <View style={styles.marketActionsContainer}>
          <TouchableOpacity
            style={styles.primaryButton}
            onPress={handleCalculateCaravanWrapper}
            disabled={loading}
          >
            <Text style={styles.primaryButtonText}>
              {loading ? 'Расчет...' : 'Посчитать'}
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryButton, styles.secondaryButton]}
            onPress={handleRefreshPrices}
            disabled={!newRelations}
          >
            <Text style={[styles.secondaryButtonText, !newRelations && { opacity: 0.6 }]}>
              Обновить цены
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.primaryButton, { backgroundColor: '#dc3545' }]}
            onPress={handleResetMarketFormWrapper}
          >
            <Text style={styles.primaryButtonText}>Очистить</Text>
          </TouchableOpacity>
        </View>

        {/* Результаты */}
        {resToPlayer.length > 0 && (
          <View style={styles.resultsCard}>
            <Text style={styles.resultsCardTitle}>Выдать игроку</Text>
            <View style={styles.resultsList}>
              {resToPlayer.map((item, index) => (
                <View key={index} style={styles.resultItem}>
                  <Image
                    source={{ uri: getResourceImageUrl(item.identificator) }}
                    style={styles.resultItemIcon}
                  />
                  <View style={styles.resultItemContent}>
                    <Text style={styles.resultItemName}>{item.name}</Text>
                    <Text style={styles.resultItemCount}>
                      Количество: {item.count}
                    </Text>
                  </View>
                </View>
              ))}
            </View>
            {totalPurchaseCost > 0 && (
              <Text style={styles.resultCost}>
                Стоимость покупки: {totalPurchaseCost}
              </Text>
            )}
            {totalSaleIncome > 0 && (
              <Text style={styles.resultIncome}>
                Выручка от продажи: {totalSaleIncome}
              </Text>
            )}
            {totalPurchaseCost > 0 || totalSaleIncome > 0 ? (
              <TouchableOpacity
                style={[styles.primaryButton, { marginTop: 15 }]}
                onPress={handleShowConfirmDialogWrapper}
                disabled={loading || caravanPending}
              >
                <Text style={styles.primaryButtonText}>
                  {loading ? 'Регистрация...' : 'Зарегистрировать караван'}
                </Text>
              </TouchableOpacity>
            ) : null}
          </View>
        )}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    paddingTop: 20,
    backgroundColor: '#1976d2',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    minWidth: 52,
    justifyContent: 'flex-end',
  },
  headerBadge: {
    backgroundColor: 'rgba(255,255,255,0.25)',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: 'white',
    textAlign: 'center',
  },
  headerBackButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 6,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  headerBackButtonText: {
    fontSize: 14,
    color: 'white',
    fontWeight: '600',
  },
  content: {
    flex: 1,
    padding: 20,
  },
  scrollViewContent: {
    paddingBottom: 120,
  },
  stepTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  stepSubtitle: {
    fontSize: 14,
    color: '#666',
    marginBottom: 15,
    textAlign: 'center',
    fontStyle: 'italic',
  },
  // Стили для рынка
  marketCheckboxesContainer: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: 'white',
    borderRadius: 8,
  },
  marketCheckboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 10,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderColor: '#1976d2',
    borderRadius: 4,
    marginRight: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxChecked: {
    backgroundColor: '#1976d2',
  },
  checkboxText: {
    color: 'white',
    fontSize: 16,
    fontWeight: 'bold',
  },
  checkboxLabel: {
    fontSize: 16,
    color: '#333',
  },
  checkboxHint: {
    fontSize: 12,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 5,
    marginLeft: 34,
  },
  guildsListContainer: {
    marginTop: 10,
  },
  guildItemContainer: {
    marginBottom: 12,
  },
  itemButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    minHeight: 60,
  },
  itemButtonContent: {
    flex: 1,
  },
  itemButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  itemButtonArrow: {
    fontSize: 24,
    color: '#999',
  },
  guildRiskText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  guildRiskTextSafe: {
    color: '#4caf50',
  },
  guildRiskTextWarning: {
    color: '#ff9800',
  },
  countryButtonsContainer: {
    marginBottom: 20,
  },
  countryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    marginRight: 10,
    borderRadius: 8,
    backgroundColor: 'white',
    borderWidth: 2,
    borderColor: '#ddd',
    minWidth: 100,
  },
  countryButtonSelected: {
    borderColor: '#1976d2',
    backgroundColor: '#e3f2fd',
  },
  countryButtonEmbargo: {
    borderColor: '#f44336',
  },
  countryFlag: {
    width: 32,
    height: 24,
    marginRight: 8,
    borderRadius: 4,
  },
  countryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  embargoLabel: {
    fontSize: 10,
    color: '#f44336',
    fontWeight: 'bold',
    marginLeft: 4,
  },
  marketFormSection: {
    marginBottom: 20,
    padding: 15,
    backgroundColor: 'white',
    borderRadius: 8,
  },
  marketFormTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#333',
  },
  resourcesInputContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  resourceInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '48%',
    padding: 12,
    borderWidth: 1,
    borderColor: '#eee',
    borderRadius: 8,
    backgroundColor: '#fafafa',
  },
  resourceIcon: {
    width: 40,
    height: 40,
    marginRight: 8,
  },
  resourceInput: {
    flex: 1,
    height: 40,
    paddingHorizontal: 8,
    fontSize: 14,
    color: '#333',
  },
  marketActionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 20,
  },
  resultsCard: {
    padding: 15,
    backgroundColor: '#e8f5e9',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4caf50',
  },
  resultsCardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 15,
    color: '#2e7d32',
  },
  resultsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 15,
  },
  resultItem: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    backgroundColor: 'white',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#4caf50',
    minWidth: 200,
  },
  resultItemIcon: {
    width: 48,
    height: 48,
    marginRight: 8,
  },
  resultItemContent: {
    flex: 1,
  },
  resultItemName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#2e7d32',
    marginBottom: 4,
  },
  resultItemCount: {
    fontSize: 14,
    color: '#1b5e20',
  },
  resultCost: {
    fontSize: 14,
    color: '#ff6f00',
    fontWeight: '600',
    marginTop: 8,
  },
  resultIncome: {
    fontSize: 14,
    color: '#2e7d32',
    fontWeight: '600',
    marginTop: 4,
  },
  primaryButton: {
    backgroundColor: '#1976d2',
    paddingVertical: 15,
    paddingHorizontal: 30,
    borderRadius: 8,
    alignItems: 'center',
    marginTop: 10,
    alignSelf: 'center',
    maxWidth: 400,
    minWidth: 300,
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: 'white',
  },
  secondaryButton: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: '#1976d2',
    paddingVertical: 12,
    paddingHorizontal: 20,
    borderRadius: 8,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#1976d2',
  },
});

export default MarketScreen;
