from django.urls import path, include
from rest_framework.routers import DefaultRouter
from . import views
from .stripe_webhooks import stripe_webhook

router = DefaultRouter()
router.register(r'cards/master', views.CardMasterViewSet, basename='cardmaster')
router.register(r'listings', views.CardListingViewSet, basename='card-listing')
router.register(r'orders', views.OrderViewSet, basename='order')
router.register(r'offers', views.OfferViewSet, basename='offer')
router.register(r'transactions', views.TransactionViewSet, basename='transaction')
router.register(r'card-grades', views.CardGradeViewSet, basename='cardgrade')
router.register(r'watchlist', views.WatchlistViewSet, basename='watchlist')

urlpatterns = [
    path('auth/', include('dj_rest_auth.urls')),
    path('auth/registration/', include('dj_rest_auth.registration.urls')),
    path('auth/allauth/', include('allauth.urls')),
] + router.urls + [
    path('webhooks/stripe/', stripe_webhook, name='stripe-webhook'),
    path('user/profile/', views.UserProfileView.as_view(), name='user-profile'),
    path('user/dashboard-stats/', views.UserDashboardStatsView.as_view(), name='user-dashboard-stats'),
    path('user/push-token/', views.PushTokenView.as_view(), name='user-push-token'),
    path('listings/<int:pk>/buy/', views.QuickBuyView.as_view(), name='listing-quick-buy'),
    path('cards/list/', views.CardMasterListAPIView.as_view(), name='card-list'),
    path('cards/<str:api_id>/', views.CardMasterDetailAPIView.as_view(), name='card-detail'),
    path('cards/<str:api_id>/stats/', views.CardDetailWithStatsAPIView.as_view(), name='card-stats'),
    path('cards/<str:api_id>/price-history/', views.CardPriceHistoryAPIView.as_view(), name='card-price-history'),
    path('cards/<str:api_id>/sold-price-history/', views.CardSoldPriceHistoryView.as_view(), name='card-sold-price-history'),
    path('market/analytics/', views.MarketAnalyticsView.as_view(), name='market-analytics'),
    path('sets/', views.SetListAPIView.as_view(), name='set-list'),
    path('rarities/', views.RarityListAPIView.as_view(), name='rarity-list'),
    path('series/', views.SeriesListAPIView.as_view(), name='series-list'),
    path('stats/', views.DatabaseStatsAPIView.as_view(), name='db-stats'),
    path('listings/analyze-photo/', views.AnalyzePhotoView.as_view(), name='listing-analyze-photo'),
    # Phase 3: photo storage pipeline
    path('photos/presign', views.PresignPhotoView.as_view(), name='photo-presign'),
    path('photos/<int:pk>/', views.PhotoDeleteView.as_view(), name='photo-delete'),
    path('listings/<int:listing_id>/photos/', views.ListingPhotosView.as_view(), name='listing-photos'),
    path('listings/bulk/', views.BulkListingUploadView.as_view(), name='listing-bulk-upload'),
    # Phase 3: auto-grading webhook (internal)
    path('internal/grade-photo', views.GradePhotoWebhookView.as_view(), name='grade-photo-webhook'),
    # Phase 5A: Reviews & Reputation
    path('orders/<int:pk>/review/', views.OrderReviewCreateView.as_view(), name='order-review-create'),
    path('users/<int:pk>/reviews/', views.UserReviewsView.as_view(), name='user-reviews'),
    path('users/<int:pk>/reputation/', views.UserReputationView.as_view(), name='user-reputation'),
    path('sellers/<int:pk>/', views.SellerPublicProfileView.as_view(), name='seller-public-profile'),
    # Phase 5D: fast trigram search endpoint
    path('search/', views.TrigamSearchView.as_view(), name='fast-search'),
    # Phase 5E: Fraud Detection & Dispute Resolution
    path('orders/<int:pk>/dispute/', views.OpenDisputeView.as_view(), name='order-dispute-open'),
    path('disputes/', views.AdminDisputeListView.as_view(), name='dispute-list'),
    path('disputes/<int:pk>/', views.AdminDisputeResolveView.as_view(), name='dispute-resolve'),
    path('', views.api_root, name='api-root'),
]
