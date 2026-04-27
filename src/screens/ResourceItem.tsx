import React from 'react';
import { View, Text, StyleSheet, Image } from 'react-native';

interface ResourceItemProps {
  identificator: string;
  name: string;
  count: number;
  imageUrl: string;
}

const ResourceItem: React.FC<ResourceItemProps> = ({ identificator, name, count, imageUrl }) => {
  return (
    <View style={styles.container}>
      <Image 
        source={{ uri: imageUrl }} 
        style={styles.icon}
        resizeMode="contain"
      />
      <Text style={styles.name}>{name}:</Text>
      <Text style={styles.count}>{count}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  icon: {
    width: 24,
    height: 24,
    marginRight: 8,
  },
  name: {
    fontSize: 14,
    color: '#f57c00',
    marginRight: 4,
    flex: 1,
  },
  count: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#e65100',
  },
});

export default ResourceItem;




