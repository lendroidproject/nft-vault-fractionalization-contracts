## `Pacemaker`






### `epochFromTimestamp(uint256 timestamp) → uint256` (public)

Displays the epoch which contains the given timestamp
        @return uint256 : Epoch value



### `epochStartTimeFromTimestamp(uint256 timestamp) → uint256` (public)

Displays timestamp when a given epoch began
        @return uint256 : Epoch start time



### `epochEndTimeFromTimestamp(uint256 timestamp) → uint256` (public)

Displays timestamp when a given epoch will end
        @return uint256 : Epoch end time



### `currentEpoch() → uint256` (public)

Calculates current epoch value from the block timestamp
        @dev Calculates the nth 8-hour window frame since the heartbeat's start time
        @return uint256 : Current epoch value




