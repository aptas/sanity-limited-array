import React from 'react';
import ArrayFunctions from 'part:@sanity/form-builder/input/array/functions';
import { map } from 'rxjs/operators';
import { isPlainObject, get } from 'lodash';
import { resolveTypeName } from '@sanity/form-builder/lib/utils/resolveTypeName';
import { FOCUS_TERMINATOR, startsWith } from '@sanity/util/paths';
import UploadTargetFieldset from '@sanity/form-builder/lib/utils/UploadTargetFieldset';
import {
	insert,
	PatchEvent,
	set,
	setIfMissing,
	unset,
} from '@sanity/form-builder/lib/PatchEvent';
import styles from '@sanity/form-builder/lib/inputs/ArrayInput/styles/ArrayInput.css';
import resolveListComponents from '@sanity/form-builder/lib/inputs/ArrayInput/resolveListComponents';
import RenderItemValue from '@sanity/form-builder/lib/inputs/ArrayInput/ItemValue';
import randomKey from '@sanity/form-builder/lib/inputs/ArrayInput/randomKey';
import Button from 'part:@sanity/components/buttons/default';
import Fieldset from 'part:@sanity/components/fieldsets/default';
import Details from '@sanity/form-builder/lib/inputs/common/Details';
import formBuilderConfig from 'config:@sanity/form-builder';

const NO_MARKERS = [];
const SUPPORT_DIRECT_UPLOADS = get(formBuilderConfig, 'images.directUploads');

function createProtoValue(type) {
	if (type.jsonType !== 'object') {
		throw new Error(
			`Invalid item type: "${type.type}". Default array input can only contain objects (for now)`
		);
	}
	const key = randomKey(12);
	return type.name === 'object'
		? { _key: key }
		: {
				_type: type.name,
				_key: key,
		  };
}

export default class ArrayInput extends React.Component {
	_element;
	uploadSubscriptions = {};
	static defaultProps = {
		focusPath: [],
	};
	state = {
		isMoving: false,
	};
	insert = (itemValue, position, atIndex) => {
		const { onChange } = this.props;
		onChange(
			PatchEvent.from(
				setIfMissing([]),
				insert([itemValue], position, [atIndex])
			)
		);
	};
	handlePrepend = (value) => {
		this.insert(value, 'before', 0);
		this.handleFocusItem(value);
	};
	handleAppend = (value) => {
		this.insert(value, 'after', -1);
		this.handleFocusItem(value);
	};
	handleRemoveItem = (item) => {
		this.removeItem(item);
	};
	handleFocus = () => {
		this.props.onFocus([FOCUS_TERMINATOR]);
	};
	handleFocusItem = (item) => {
		this.props.onFocus([{ _key: item._key }, FOCUS_TERMINATOR]);
	};

	removeItem(item) {
		const { onChange, onFocus, value } = this.props;
		onChange(
			PatchEvent.from(
				unset(item._key ? [{ _key: item._key }] : [value.indexOf(item)])
			)
		);
		if (item._key in this.uploadSubscriptions) {
			this.uploadSubscriptions[item._key].unsubscribe();
		}
		const idx = value.indexOf(item);
		const nextItem = value[idx + 1] || value[idx - 1];
		onFocus([nextItem ? { _key: nextItem._key } : FOCUS_TERMINATOR]);
	}

	handleItemChange = (event, item) => {
		const { onChange, value } = this.props;
		const memberType = this.getMemberTypeOfItem(item);
		if (!memberType) {
			// eslint-disable-next-line no-console
			console.log('Could not find member type of item ', item);
			return;
		}
		if (memberType.readOnly) {
			return;
		}
		const key = item._key || randomKey(12);
		onChange(
			event
				.prefixAll({ _key: key })
				.prepend(
					item._key ? [] : set(key, [value.indexOf(item), '_key'])
				)
		);
	};
	handleSortStart = () => {
		this.setState({ isMoving: true });
	};
	handleSortEnd = (event) => {
		this.setState({ isMoving: false });
		const { value, onChange } = this.props;
		const item = value[event.oldIndex];
		const refItem = value[event.newIndex];
		// console.log('from %d => %d', event.oldIndex, event.newIndex, event)
		if (!item._key || !refItem._key) {
			// eslint-disable-next-line no-console
			console.error(
				'Neither the item you are moving nor the item you are moving to have a key. Cannot continue.'
			);
			return;
		}
		if (event.oldIndex === event.newIndex || item._key === refItem._key) {
			return;
		}
		onChange(
			PatchEvent.from(
				unset([{ _key: item._key }]),
				insert(
					[item],
					event.oldIndex > event.newIndex ? 'before' : 'after',
					[{ _key: refItem._key }]
				)
			)
		);
	};

	getMemberTypeOfItem(item) {
		const { type } = this.props;
		const itemTypeName = resolveTypeName(item);
		return type.of.find((memberType) => memberType.name === itemTypeName);
	}

	renderList = () => {
		const {
			type,
			markers,
			readOnly,
			value,
			focusPath,
			onBlur,
			onFocus,
			level,
			filterField,
		} = this.props;
		const { isMoving } = this.state;
		const options = type.options || {};
		const hasMissingKeys = value.some((item) => !item._key);
		const isSortable = options.sortable !== false && !hasMissingKeys;
		const isGrid = options.layout === 'grid';
		const { List, Item } = resolveListComponents(isSortable, isGrid);
		const listProps = isSortable
			? {
					movingItemClass: styles.movingItem,
					onSortEnd: this.handleSortEnd,
					onSortStart: this.handleSortStart,
					lockToContainerEdges: true,
					useDragHandle: !isGrid,
			  }
			: {};
		const listItemClassName = isMoving
			? styles.listItemMute
			: styles.listItem;
		return (
			<List
				className={readOnly ? styles.listReadOnly : styles.list}
				{...listProps}
			>
				{value.map((item, index) => {
					const isChildMarker = (marker) =>
						startsWith([index], marker.path) ||
						startsWith([{ _key: item && item._key }], marker.path);
					const childMarkers = markers.filter(isChildMarker);

					const itemProps = isSortable ? { index } : {};
					return (
						<Item
							key={item._key}
							className={
								isGrid ? styles.gridItem : listItemClassName
							}
							{...itemProps}
						>
							<RenderItemValue
								type={type}
								value={item}
								level={level}
								markers={
									childMarkers.length === 0
										? NO_MARKERS
										: childMarkers
								}
								onRemove={this.handleRemoveItem}
								onChange={this.handleItemChange}
								focusPath={focusPath}
								filterField={filterField}
								onFocus={onFocus}
								onBlur={onBlur}
								readOnly={readOnly || hasMissingKeys}
							/>
						</Item>
					);
				})}
			</List>
		);
	};

	focus() {
		if (this._element) {
			this._element.focus();
		}
	}

	setElement = (el) => {
		this._element = el;
	};
	getUploadOptions = (file) => {
		const { type, resolveUploader } = this.props;
		if (!resolveUploader) {
			return [];
		}
		return type.of
			.map((memberType) => {
				const uploader = resolveUploader(memberType, file);
				return (
					uploader && {
						type: memberType,
						uploader,
					}
				);
			})
			.filter(Boolean);
	};
	handleFixMissingKeys = () => {
		const { onChange, value } = this.props;
		const patches = value.map((val, i) =>
			setIfMissing(randomKey(), [i, '_key'])
		);
		onChange(PatchEvent.from(...patches));
	};
	handleRemoveNonObjectValues = () => {
		const { onChange, value } = this.props;
		const nonObjects = value
			.reduce(
				(acc, val, i) => (isPlainObject(val) ? acc : acc.concat(i)),
				[]
			)
			.reverse();
		const patches = nonObjects.map((index) => unset([index]));
		onChange(PatchEvent.from(...patches));
	};
	handleUpload = ({ file, type, uploader }) => {
		const { onChange } = this.props;
		const item = createProtoValue(type);
		const key = item._key;
		this.insert(item, 'after', -1);
		const events$ = uploader.upload(file, type).pipe(
			map((uploadEvent) =>
				PatchEvent.from(uploadEvent.patches).prefixAll({
					_key: key,
				})
			)
		);
		this.uploadSubscriptions = {
			...this.uploadSubscriptions,
			[key]: events$.subscribe(onChange),
		};
	};

	render() {
		const { type, level, markers, readOnly, onChange, value } = this.props;
		const hasNonObjectValues = (value || []).some(
			(item) => !isPlainObject(item)
		);
		if (hasNonObjectValues) {
			return (
				<Fieldset
					legend={type.title}
					description={type.description}
					level={level}
					tabIndex={0}
					onFocus={this.handleFocus}
					ref={this.setElement}
					markers={markers}
				>
					<div className={styles.nonObjectsWarning}>
						Some items in this list are not objects. We need to
						remove them before the list can be edited.
						<div className={styles.removeNonObjectsButtonWrapper}>
							<Button onClick={this.handleRemoveNonObjectValues}>
								Remove non-object values
							</Button>
						</div>
						<Details title={<b>Why is this happening?</b>}>
							This usually happens when items are created through
							an API client from outside the Content Studio and
							sets invalid data, or a custom input component have
							inserted incorrect values into the list.
						</Details>
					</div>
				</Fieldset>
			);
		}
		const hasMissingKeys = (value || []).some((item) => !item._key);
		if (hasMissingKeys) {
			return (
				<Fieldset
					legend={type.title}
					description={type.description}
					level={level}
					tabIndex={0}
					onFocus={this.handleFocus}
					ref={this.setElement}
					markers={markers}
				>
					<div className={styles.missingKeysWarning}>
						Some items in this list are missing their keys. We need
						to fix this before the list can be edited.
						<div className={styles.fixMissingKeysButtonWrapper}>
							<Button onClick={this.handleFixMissingKeys}>
								Fix missing keys
							</Button>
						</div>
						<Details title={<b>Why is this happening?</b>}>
							This usually happens when items are created through
							the API client from outside the Content Studio and
							someone forgets to set the <code>_key</code>
							-property of list items.
							<p>
								The value of the <code>_key</code> can be any{' '}
								<b>string</b> as long as it is <b>unique</b> for
								each element within the array.
							</p>
						</Details>
					</div>
					{this.renderList()}
				</Fieldset>
			);
		}
		const FieldSetComponent = SUPPORT_DIRECT_UPLOADS
			? UploadTargetFieldset
			: Fieldset;
		const uploadProps = SUPPORT_DIRECT_UPLOADS
			? {
					getUploadOptions: this.getUploadOptions,
					onUpload: this.handleUpload,
			  }
			: {};

		/* START things that are added by us */

		const limit = type.options.limit || Number.MAX_SAFE_INTEGER;
		const typeLimits = type.options.typeLimits;

		let arrayFunctionsType = type;

		if (typeLimits && value && value.length) {
			const typeCounts = {};

			value.forEach(({ _type }) => {
				if (!typeCounts[_type]) {
					typeCounts[_type] = 0;
				}

				typeCounts[_type]++;
			});

			const filteredOf = type.of.filter((currentType) => {
				const { name } = currentType;

				const count = typeCounts[name] || 0;

				let limit;
				if (Number.isFinite(typeLimits)) {
					limit = typeLimits;
				} else {
					limit =
						typeLimits[name] ||
						typeLimits._default ||
						Number.MAX_SAFE_INTEGER;
				}

				return count < limit;
			});

			arrayFunctionsType = {
				...type,
				of: filteredOf,
			};
		}

		const showArrayFunctions =
			(!value || value.length < limit) &&
			Boolean(arrayFunctionsType.of.length);

		/* END things that are added by us (+ conditional show in return) */

		return (
			<FieldSetComponent
				markers={markers}
				tabIndex={0}
				legend={type.title}
				description={type.description}
				level={level}
				className={styles.root}
				onFocus={this.handleFocus}
				type={type}
				ref={this.setElement}
				{...uploadProps}
			>
				<div>
					{value && value.length > 0 && this.renderList()}
					{showArrayFunctions && (
						<ArrayFunctions
							type={type}
							value={value}
							readOnly={readOnly}
							onAppendItem={this.handleAppend}
							onPrependItem={this.handlePrepend}
							onFocusItem={this.handleFocusItem}
							onCreateValue={createProtoValue}
							onChange={onChange}
						/>
					)}
				</div>
			</FieldSetComponent>
		);
	}
}
