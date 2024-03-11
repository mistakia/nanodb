library(httr)
library(ggplot2)
library(jsonlite)
library(scales) # Added for scale transformation
library(tidyr)

# Fetch JSON data from the URL
url <- "nano.community/api/nanodb/blocks/confirmed/summary"
response <- GET(url)
json_data <- content(response, "text")
data <- fromJSON(json_data)

# Initialize vectors
bucket_names <- names(data$confirmation_latency_ms_by_bucket)
bucket_indices <- as.numeric(gsub("bucket_", "", bucket_names)) # Extract numeric indices
bucket_indices_sorted <- sort(bucket_indices) # Sort numerically
buckets <- sprintf("bucket_%d", bucket_indices_sorted) # Reconstruct sorted bucket names
medians <- numeric(length(buckets))
min_vals <- numeric(length(buckets))
max_vals <- numeric(length(buckets))
confirmed_blocks <- numeric(length(buckets))

# Populate vectors
for (i in seq_along(buckets)) {
  bucket_data <- data$confirmation_latency_ms_by_bucket[[buckets[i]]] # Use sorted bucket names
  medians[i] <- bucket_data$median / 1000 # Convert milliseconds to seconds
  min_vals[i] <- bucket_data$min / 1000 # Convert milliseconds to seconds
  max_vals[i] <- bucket_data$max / 1000 # Convert milliseconds to seconds
  confirmed_blocks[i] <- ifelse(is.null(bucket_data$confirmed_blocks), 0, bucket_data$confirmed_blocks)
}

# Create data frame
df <- data.frame(bucket = bucket_indices_sorted, median = medians, min = min_vals, max = max_vals, confirmed_blocks = confirmed_blocks)

df$bucket <- factor(df$bucket, levels = bucket_indices_sorted)

df_long <- pivot_longer(df, cols = c(median, confirmed_blocks), names_to = "metric", values_to = "value")

ggplot(df_long, aes(x = bucket, y = value, fill = metric)) +
  geom_bar(stat = "identity", position = position_dodge()) +
  facet_wrap(~metric, scales = "free_y", ncol = 1, labeller = as_labeller(c(median = "Median Latency in seconds (log scale)", confirmed_blocks = "Confirmed Blocks (log scale)"))) +
  scale_y_continuous(trans = 'log10', labels = scales::comma) +
  theme(axis.text.x = element_text(angle = 90, hjust = 1)) +
  labs(title = "confirmation latency by bucket (24h)")