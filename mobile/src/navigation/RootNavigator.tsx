import React, { useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../AuthContext';
import { colors } from '../theme';
import { navigationRef } from './ref';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import GuestCheckoutScreen from '../screens/GuestCheckoutScreen';
import ShopScreen from '../screens/ShopScreen';
import ProductDetailScreen from '../screens/ProductDetailScreen';
import PublicShopScreen from '../screens/PublicShopScreen';
import CartScreen from '../screens/CartScreen';
import CheckoutScreen from '../screens/CheckoutScreen';
import OrdersScreen from '../screens/OrdersScreen';
import MessagesScreen from '../screens/MessagesScreen';
import ThreadScreen from '../screens/ThreadScreen';
import ProfileScreen from '../screens/ProfileScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import FavoritesScreen from '../screens/FavoritesScreen';
import WishlistScreen from '../screens/WishlistScreen';
import NotificationsScreen from '../screens/NotificationsScreen';
import SettingsScreen from '../screens/SettingsScreen';
import SellScreen from '../screens/SellScreen';
import MyListingsScreen from '../screens/MyListingsScreen';
import SellerDashboardScreen from '../screens/SellerDashboardScreen';
import OffersScreen from '../screens/OffersScreen';
import AdminScreen from '../screens/AdminScreen';
import type {
  AccountStackParamList,
  AuthStackParamList,
  CartStackParamList,
  MainTabParamList,
  OrdersStackParamList,
  RootStackParamList,
  SellStackParamList,
  ShopStackParamList,
} from './types';

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<AuthStackParamList>();
const ShopStack = createNativeStackNavigator<ShopStackParamList>();
const CartStack = createNativeStackNavigator<CartStackParamList>();
const OrdersStack = createNativeStackNavigator<OrdersStackParamList>();
const SellStack = createNativeStackNavigator<SellStackParamList>();
const AccountStack = createNativeStackNavigator<AccountStackParamList>();
const Tab = createBottomTabNavigator<MainTabParamList>();

function AuthNavigator() {
  return (
    <AuthStack.Navigator screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="Login" component={LoginScreen} />
      <AuthStack.Screen name="Register" component={RegisterScreen} />
      <AuthStack.Screen name="ForgotPassword" component={ForgotPasswordScreen} />
      <AuthStack.Screen name="GuestCheckout" component={GuestCheckoutScreen} />
    </AuthStack.Navigator>
  );
}

function ShopNavigator() {
  return (
    <ShopStack.Navigator>
      <ShopStack.Screen name="ShopHome" component={ShopScreen} options={{ headerShown: false }} />
      <ShopStack.Screen
        name="ProductDetail"
        component={ProductDetailScreen}
        options={{ title: 'Product', headerTintColor: colors.brand }}
      />
      <ShopStack.Screen
        name="PublicShop"
        component={PublicShopScreen}
        options={{ title: 'Shop', headerTintColor: colors.brand }}
      />
    </ShopStack.Navigator>
  );
}

function CartNavigator() {
  return (
    <CartStack.Navigator>
      <CartStack.Screen name="CartHome" component={CartScreen} options={{ headerShown: false }} />
      <CartStack.Screen
        name="Checkout"
        component={CheckoutScreen}
        options={{ title: 'Checkout', headerTintColor: colors.brand }}
      />
    </CartStack.Navigator>
  );
}

function OrdersNavigator() {
  return (
    <OrdersStack.Navigator screenOptions={{ headerShown: false }}>
      <OrdersStack.Screen name="OrdersList" component={OrdersScreen} />
    </OrdersStack.Navigator>
  );
}

function SellNavigator() {
  return (
    <SellStack.Navigator>
      <SellStack.Screen name="SellHome" component={SellScreen} options={{ headerShown: false }} />
      <SellStack.Screen
        name="MyListings"
        component={MyListingsScreen}
        options={{ title: 'My listings', headerTintColor: colors.brand }}
      />
    </SellStack.Navigator>
  );
}

function AccountNavigator() {
  return (
    <AccountStack.Navigator>
      <AccountStack.Screen name="AccountHome" component={ProfileScreen} options={{ headerShown: false }} />
      <AccountStack.Screen
        name="EditProfile"
        component={EditProfileScreen}
        options={{ title: 'Edit profile', headerTintColor: colors.brand }}
      />
      <AccountStack.Screen
        name="Favorites"
        component={FavoritesScreen}
        options={{ title: 'Favorites', headerTintColor: colors.brand }}
      />
      <AccountStack.Screen
        name="Wishlist"
        component={WishlistScreen}
        options={{ title: 'Wishlist', headerTintColor: colors.brand }}
      />
      <AccountStack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ title: 'Notifications', headerTintColor: colors.brand }}
      />
      <AccountStack.Screen
        name="Settings"
        component={SettingsScreen}
        options={{ title: 'Settings', headerTintColor: colors.brand }}
      />
      <AccountStack.Screen
        name="SellerDashboard"
        component={SellerDashboardScreen}
        options={{ title: 'Seller dashboard', headerTintColor: colors.brand }}
      />
      <AccountStack.Screen
        name="Offers"
        component={OffersScreen}
        options={{ title: 'Offers', headerTintColor: colors.brand }}
      />
      <AccountStack.Screen
        name="Admin"
        component={AdminScreen}
        options={{ title: 'Admin', headerTintColor: colors.brand }}
      />
      <AccountStack.Screen
        name="Inbox"
        component={MessagesScreen}
        options={{ title: 'Messages', headerTintColor: colors.brand }}
      />
      <AccountStack.Screen
        name="Thread"
        component={ThreadScreen}
        options={({ route }) => ({
          title: route.params.title || 'Chat',
          headerTintColor: colors.brand,
        })}
      />
    </AccountStack.Navigator>
  );
}

const TAB_ICONS: Record<keyof MainTabParamList, keyof typeof Ionicons.glyphMap> = {
  ShopTab: 'storefront-outline',
  SellTab: 'pricetag-outline',
  CartTab: 'cart-outline',
  OrdersTab: 'receipt-outline',
  AccountTab: 'person-outline',
};

function MainTabs() {
  const { token } = useAuth();
  const [cartCount, setCartCount] = useState(0);
  const [msgCount, setMsgCount] = useState(0);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!token) {
        setCartCount(0);
        setMsgCount(0);
        return;
      }
      try {
        const { api } = await import('../api');
        const [cart, msgs] = await Promise.all([
          api.cartCount(token).catch(() => null),
          api.unreadMessageCount(token).catch(() => null),
        ]);
        if (cancelled) return;
        setCartCount(Number(cart?.count || cart?.cartCount || 0));
        setMsgCount(Number(msgs?.unread || msgs?.count || 0));
      } catch {
        /* ignore badge errors */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: { borderTopColor: colors.border },
        tabBarIcon: ({ color, size }) => (
          <Ionicons name={TAB_ICONS[route.name]} size={size} color={color} />
        ),
      })}
    >
      <Tab.Screen name="ShopTab" component={ShopNavigator} options={{ title: 'Shop' }} />
      <Tab.Screen name="SellTab" component={SellNavigator} options={{ title: 'Sell' }} />
      <Tab.Screen
        name="CartTab"
        component={CartNavigator}
        options={{
          title: 'Cart',
          tabBarBadge: cartCount > 0 ? cartCount : undefined,
        }}
      />
      <Tab.Screen name="OrdersTab" component={OrdersNavigator} options={{ title: 'Orders' }} />
      <Tab.Screen
        name="AccountTab"
        component={AccountNavigator}
        options={{
          title: 'Account',
          tabBarBadge: msgCount > 0 ? msgCount : undefined,
        }}
      />
    </Tab.Navigator>
  );
}

export default function RootNavigator() {
  const { booting } = useAuth();

  if (booting) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: colors.surface,
        }}
      >
        <ActivityIndicator color={colors.accent} size="large" />
      </View>
    );
  }

  return (
    <NavigationContainer ref={navigationRef}>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        <RootStack.Screen name="Main" component={MainTabs} />
        <RootStack.Screen
          name="Auth"
          component={AuthNavigator}
          options={{ presentation: 'modal' }}
        />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
